# Invoice readiness demo

A completed repair job is not ready to invoice until Finance knows what work was done, which charges the quote supports, and what the customer confirmed in writing. This demo walks through that check step by step for one realistic case, and runs the two steps where AI helps.

**Rules decide, AI reads, humans approve.** AI is used at exactly two points, both reading unstructured text. Code verifies everything it returns, and a person makes every accountable call.

## Run it

```bash
npm install
cp .env.example .env   # optional: add ANTHROPIC_API_KEY for live AI
npm run dev            # http://localhost:3000
```

- Without a key, or if the API call fails, both AI steps return the recorded responses in `data/case-001/recorded/` and show a **Recorded** badge. The demo runs fully offline.
- `ANTHROPIC_MODEL` picks the model (default `claude-sonnet-5-5`).
- Controls: **→** next, **←** back, **R** reset. Built for 1440×900.

## Demo script (about 5 minutes)

1. **Step 1–3.** "Finance first has to find the records. A rule collects them and checks they open; unreadable files go to a person right away."
2. **Step 4, Run AI.** "The customer email has no WO number, so rules can't link it. The prefilter keeps Acme jobs within 14 days; AI ranks them and cites signals."
3. Point at the checks: "Every signal must appear in both records, or code drops it. WO-4475 was removed by rule before AI saw it." Click **Confirm link** on WO-4471.
4. **Step 5–7.** "An AI suggestion is never a clear match. A person confirms it, or the job waits with a clear question."
5. **Step 8–9.** "A checklist rule names any missing record, so the chase is specific."
6. **Step 10, Run AI.** "AI extracts hours and the customer's approval. Every value carries a verbatim quote; the highlights are where it came from."
7. **Step 11–12.** "Code checks each quote against its source page. Any miss or ambiguity sends it to a person, not forward."
8. **Step 13.** "Plain arithmetic: the report shows 8.0 h on site, the quote covers 6.0 h, the email approves 1.5 h. That leaves 0.5 h with no written approval."
9. **Step 14.** "The report is a template, not generated text. Each finding links to its source."
10. **Step 15.** "Finance picks: bill 7.5 h plus the travel fee now, or ask Acme to approve the 0.5 h. The system lays out the options; the person decides."

## How it is built

| Path | What it does |
|---|---|
| `lib/flow.ts` | The 15 steps, edges and layout |
| `lib/checks.ts` | Every rule: identifier regex, prefilter, signal and quote verification, hours comparison |
| `lib/llm.ts` | `callTool`: one strict tool call to Claude, with the recorded fallback |
| `lib/report.ts` | The final report template |
| `lib/case.ts` | Loads the sample case from `data/case-001/` |
| `app/api/suggest-links` | AI #1: regex → prefilter → LLM ranks → code verifies → human confirms |
| `app/api/extract-evidence` | AI #2: LLM extracts with quotes → code verifies → pass only if nothing flagged |
| `components/` | Flowchart (React Flow), step panel, page shell |

All companies, people and documents in the sample case are fictional.
