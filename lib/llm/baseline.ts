import "server-only";
import type { CheckInput } from "@/lib/run/check";

const BASE_URL = "https://integrate.api.nvidia.com/v1";
export const BASELINE_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
const TIMEOUT_MS = 20_000;
const MAX_TITLES = 6;

export class BaselineError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BaselineError";
  }
}

export interface BaselineResult {
  model: string;
  thinking: false;
  titles: CheckInput[];
}

// What an author gets from asking a plain LLM. Seeds are passed as a JSON array so
// a title can't read as an instruction. Thinking is off to keep it fast, and the UI says so.
export async function plainLlmComps(seeds: string[], options: { apiKey?: string; fetcher?: typeof fetch } = {}): Promise<BaselineResult> {
  const apiKey = options.apiKey ?? process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new BaselineError("NVIDIA_API_KEY is not set");
  const fetcher = options.fetcher ?? fetch;

  let res: Response;
  try {
    res = await fetcher(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: BASELINE_MODEL,
        temperature: 0,
        max_tokens: 800,
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          {
            role: "user",
            content: `I'm writing a novel that reads like these books: ${JSON.stringify(seeds)}. Suggest ${MAX_TITLES} recent comp titles for my query letter. Reply with only JSON: {"comps":[{"title":"...","author":"..."}]}`,
          },
        ],
      }),
    });
  } catch (err) {
    throw new BaselineError("The LLM didn't answer in time", { cause: err });
  }
  if (!res.ok) throw new BaselineError(`The LLM returned ${res.status}`);
  const body = (await res.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null;
  const content = body?.choices?.[0]?.message?.content;
  return { model: BASELINE_MODEL, thinking: false, titles: parseLlmTitles(typeof content === "string" ? content : "") };
}

// Model output is untrusted. Pull the first JSON object, keep only string fields, cap the count.
export function parseLlmTitles(content: string): CheckInput[] {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.slice(start, end + 1));
  } catch {
    return [];
  }
  const comps = (parsed as { comps?: unknown })?.comps;
  if (!Array.isArray(comps)) return [];
  const out: CheckInput[] = [];
  for (const c of comps) {
    const title = typeof c?.title === "string" ? c.title.trim().slice(0, 200) : "";
    const author = typeof c?.author === "string" ? c.author.trim().slice(0, 120) : "";
    if (!title) continue;
    out.push(author ? { title, author } : { title });
    if (out.length === MAX_TITLES) break;
  }
  return out;
}
