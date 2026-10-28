import { Bot, CircleCheck, CircleX, LoaderCircle, Wrench } from "lucide-react";
import type { AgentEvent, ToolEvent } from "./types";

const TOOL_LABEL: Record<ToolEvent["name"], string> = {
  resolve_titles: "resolve_titles: look up your books in Qloo",
  find_comps: "find_comps: ask Qloo for readers' picks, then check the rules",
};

// Each line is a tool call the agent actually made, as reported by the server.
export function AgentLog({ agent, tools }: { agent: AgentEvent[]; tools: ToolEvent[] }) {
  const first = agent[0]!;
  const fallback = agent.find((a) => a.mode === "fixed" && a !== first) ?? (first.mode === "fixed" ? first : null);
  return (
    <details className="agent-log" open>
      <summary>
        {first.mode === "agent" ? (
          <><Bot size={16} strokeWidth={1.75} aria-hidden="true" /> Agent <code>{first.model}</code> chose these tool calls</>
        ) : (
          <><Wrench size={16} strokeWidth={1.75} aria-hidden="true" /> Standard steps (the model didn't answer)</>
        )}
      </summary>
      {tools.length > 0 && (
        <ol role="list">
          {tools.map((t, i) => (
            <li key={i} className={`tool tool-${t.status}`}>
              {t.status === "start" ? (
                <LoaderCircle className="spin" size={15} aria-hidden="true" />
              ) : t.status === "error" ? (
                <CircleX size={15} aria-hidden="true" />
              ) : (
                <CircleCheck size={15} aria-hidden="true" />
              )}
              <code>{TOOL_LABEL[t.name]}</code>
              <span className="small muted">{t.status === "start" ? " running" : t.status === "error" ? ` failed after ${t.ms}ms` : ` ${t.ms}ms`}</span>
            </li>
          ))}
        </ol>
      )}
      {fallback && fallback !== first && <p className="small warn">{fallback.reason}</p>}
      {first.mode === "agent" && <p className="small muted">The model only picks the tool and its input. Books and verdicts come from Qloo and the rules.</p>}
    </details>
  );
}
