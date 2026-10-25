# Nearshelf

Comp titles for novelists that are recent, mid-list and real, picked from Qloo reader data and checked against rules in code.

**Live app:** https://nearshelf.vercel.app

## The problem

Every query letter to a literary agent needs two or three comparable titles. Agents want them recent (published in the last three years or so) and mid-sized, because comparing your debut to a megahit reads as naive. Self-published authors need the same list to target ads.

Finding good comps means reading widely in your genre for months. Asking an LLM is faster but unreliable. It suggests decade-old classics and bestsellers, credits books to the wrong author, and sometimes invents titles. An author who pastes those into a query letter looks unprepared.

Nearshelf gives the author comps that are actually read by the same readers as their book, and shows why each one qualifies.

## What it does

1. **Enter up to three books your novel reads like**, or pick a preset. Choose how recent comps must be (2 to 5 years).
2. **The agent looks them up in Qloo.** Each field shows whether the book was found, isn't a real book, or is real but has no Qloo reader data.
3. **Qloo returns books those readers also love.** Every candidate is re-checked in code:
   - published inside the recency window
   - under the popularity ceiling (not a megahit)
   - not one of your own seed books
   - not a duplicate
4. **Accepted comps go on the shelf.** Click a spine to see its evidence: Qloo entity ID, publication year, popularity score and the seeds used. Rejected candidates are listed with the rule they broke and the value that failed it.
5. **Copy your comp line** ("My novel will appeal to readers of A and B") or share a link that reruns the same search.
6. **Check my comps:** paste the comps you already have and see which pass and which don't, and why.
7. **What a plain LLM said:** the same seeds go to an LLM with no Qloo access, and its titles are run through the same checks on the same screen.

## How Qloo is used

| Step | Qloo call | What it gives Nearshelf |
|---|---|---|
| Resolve seeds | `GET /search` with `types=urn:entity:book` | The book's Qloo entity, author, year and popularity |
| Find candidates | `GET /v2/insights` with `filter.type=urn:entity:book`, `signal.interests.entities`, `filter.publication_year.min`, `filter.popularity.max`, `feature.explainability=true`, `take=30` | Books the seeds' readers love, already narrowed by year and size |
| Check pasted and LLM titles | `GET /search` | Whether a title exists and what Qloo knows about it |

Qloo is the only source of candidates and popularity in the app. Remove it and there are no comps, no size rule and no evidence to show.

Qloo silently ignores parameters it doesn't support, so the year and popularity filters aren't trusted on their own. The rule engine (`lib/rules/engine.ts`) re-checks every candidate, and a test proves a stale book is still rejected when the filter is dropped.

Responses are cached server-side for 24 hours, in memory per instance and in Next's data cache across instances, with identical in-flight requests merged into one call. Failed calls are never cached. No Qloo response data is stored in this repository.

## The agent

Runs are driven by a tool-calling agent built with the Vercel AI SDK on an NVIDIA-hosted model (`nemotron-3.5-lightning-30b-a3b`). It chooses when to call two tools:

- `resolve_titles` looks up the author's seed titles in Qloo
- `find_comps` queries Qloo Insights with the resolved seeds and applies the rules

The page streams each tool call as it happens. The agent decides *what to call*, never *what to recommend*:

- It can only resolve titles the author typed. Anything else it passes is ignored.
- It can only query with seed IDs that `resolve_titles` returned, so it can't add a book.
- Its own text is never shown. Every book on screen comes from Qloo, and every verdict comes from the rule engine.
- Seed titles are passed to the model as JSON data, never as instructions.

If the model fails or stops early, a fixed sequence finishes the run from where it stopped, without repeating Qloo calls.

## Why not just ask an LLM?

The comparison panel answers this live. In one test run with *The Jasmine Throne*, *The Spear Cuts Through Water* and *Godkiller* as seeds, the plain model returned all three seed books as comps, credited two of them to the wrong authors, and suggested a title that doesn't appear to exist. Nearshelf can't make those mistakes, because a book only reaches the shelf if Qloo knows it and it passes every rule.

## Run it locally

Requires Node 22 or newer.

```bash
npm install
cp .env.example .env.local   # add your keys
npm run dev                  # http://localhost:3000
```

Without `QLOO_API_KEY` the app runs and reports that Qloo isn't connected. Without `NVIDIA_API_KEY` runs use the fixed tool sequence and the comparison panel shows as unavailable.

```bash
npm test           # unit and integration tests (Vitest)
npm run typecheck
npm run build
```

Tests use synthetic data and scripted models. They cover the rules, the agent's guardrails, fallback behavior, the Qloo client's errors and retries, and the cache.

## Project layout

```text
app/              page and API routes (/api/run, /api/check, /api/baseline)
components/       shelf, evidence, agent log, checker, comparison panel
lib/agent/        tool-calling agent
lib/qloo/         Qloo client, response parsing, cache
lib/rules/        rule engine and rule labels
lib/run/          run session, seed resolution, comp checking, rate limit
lib/llm/          plain-LLM comparison
lib/openlibrary/  Open Library cross-check for publication years
tests/
```

## Limits

- Books only. Qloo's coverage of recent mid-list fiction decides how many comps a given genre gets.
- The popularity ceiling is a single number for every genre, set from known megahits and mid-list titles.
- Open Library is a cross-check only. If it's down, Qloo's data is used alone.
- The rate limit (20 runs per 10 minutes per IP) is enforced per server instance.

## License

[MIT](LICENSE)
