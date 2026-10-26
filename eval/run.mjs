#!/usr/bin/env node
// Runs every seed set through Nearshelf and the plain-LLM baseline on a live server
// and counts how many titles from each pass the same rules.
// Usage: node eval/run.mjs [baseUrl]   (default http://localhost:3000)
// Writes eval/results.json (aggregate counts only) and eval/raw/ (titles, git-ignored).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const WINDOW_YEARS = 3;

async function post(path, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.status !== 429) return res;
    console.log(`  rate limited on ${path}, waiting 70s`);
    await new Promise((r) => setTimeout(r, 70_000));
  }
  throw new Error(`${path} stayed rate limited`);
}

async function runNearshelf(seeds) {
  const started = Date.now();
  const res = await post("/api/run", { seeds, windowYears: WINDOW_YEARS });
  const events = (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const result = events.find((e) => e.type === "result");
  const error = events.find((e) => e.type === "error");
  if (!result) throw new Error(`run failed: ${error?.message ?? "no result"}`);
  const agent = events.find((e) => e.type === "agent");
  return { ms: Date.now() - started, mode: agent?.mode ?? null, accepted: result.accepted, rejected: result.rejected };
}

async function runBaseline(seeds) {
  const res = await post("/api/baseline", { seeds, windowYears: WINDOW_YEARS });
  const body = await res.json();
  // Unchecked titles would turn into fake zeros. Stop instead.
  if (body.state !== "CHECKED") throw new Error(`baseline not checked: ${body.state} ${body.message ?? ""}`);
  return body;
}

const count = (arr, fn) => arr.filter(fn).length;

async function main() {
  const sets = JSON.parse(await readFile(join(DIR, "seeds.json"), "utf8"));
  const raw = [];
  const perSet = [];
  for (const { genre, seeds } of sets) {
    console.log(`${genre}: ${seeds.join(", ")}`);
    const ns = await runNearshelf(seeds);
    const bl = await runBaseline(seeds);
    const r = bl.results;
    const rule = (name) => count(r, (x) => x.failures.some((f) => f.rule === name));
    perSet.push({
      genre,
      nearshelf: { accepted: ns.accepted.length, ms: ns.ms, mode: ns.mode },
      llm: {
        titles: r.length,
        passed: count(r, (x) => x.status === "ACCEPTED"),
        notFound: count(r, (x) => x.status === "NOT_FOUND"),
        noReaderData: count(r, (x) => x.status === "NO_QLOO_DATA"),
        tooOld: rule("too_old"),
        tooBig: rule("too_big"),
        echoedSeed: rule("is_seed"),
        wrongAuthor: count(r, (x) => x.authorMismatch),
      },
    });
    raw.push({ genre, seeds, nearshelf: ns, llm: bl });
    console.log(`  nearshelf ${ns.accepted.length} comps in ${ns.ms}ms (${ns.mode}), llm ${perSet.at(-1).llm.passed}/${r.length} passed`);
  }

  const sum = (pick) => perSet.reduce((n, s) => n + pick(s), 0);
  const totals = {
    sets: perSet.length,
    nearshelfComps: sum((s) => s.nearshelf.accepted),
    nearshelfSetsWithThreePlus: count(perSet, (s) => s.nearshelf.accepted >= 3),
    llmTitles: sum((s) => s.llm.titles),
    llmPassed: sum((s) => s.llm.passed),
    llmNotFound: sum((s) => s.llm.notFound),
    llmNoReaderData: sum((s) => s.llm.noReaderData),
    llmTooOld: sum((s) => s.llm.tooOld),
    llmTooBig: sum((s) => s.llm.tooBig),
    llmEchoedSeed: sum((s) => s.llm.echoedSeed),
    llmWrongAuthor: sum((s) => s.llm.wrongAuthor),
  };

  await writeFile(join(DIR, "results.json"), JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, windowYears: WINDOW_YEARS, model: raw[0]?.llm.model ?? null, totals, perSet }, null, 2) + "\n");
  await mkdir(join(DIR, "raw"), { recursive: true });
  await writeFile(join(DIR, "raw", "latest.json"), JSON.stringify(raw, null, 2));

  console.log("\n| | Titles | Passed every rule |\n|---|---|---|");
  console.log(`| Nearshelf | ${totals.nearshelfComps} | ${totals.nearshelfComps} (by construction) |`);
  console.log(`| Plain LLM | ${totals.llmTitles} | ${totals.llmPassed} |`);
  console.log(`\nLLM misses: ${totals.llmNotFound} not found, ${totals.llmTooOld} too old, ${totals.llmTooBig} too big, ${totals.llmEchoedSeed} repeated a seed, ${totals.llmWrongAuthor} wrong author`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
