import { loadCase } from "@/lib/case";
import { callTool, doc } from "@/lib/llm";
import { emailMeta, findExplicitIds, prefilterCandidates, verifySignals, type LinkSuggestion } from "@/lib/checks";

const SYSTEM = `You help a billing team link a customer email to the work order it is about.
Use only the documents provided. Call the suggest_links tool once.
Every work order in the list already has the right customer and a completion date within 14 days of the email, so customer and date do not tell them apart.
Return each work order in the list exactly once, ranked from most to least likely; give unlikely ones confidence "low".
For each candidate, list the evidence signals: "field" is the work order field, "value" is text copied word for word from the email that also appears in that field.
Do not infer, convert or calculate values. For example, never turn "yesterday" into a date. If no candidate fits, return an empty list and explain why in noMatchReason.`;

const TOOL = {
  name: "suggest_links",
  description: "Return candidate work orders for the email, ranked, with evidence signals.",
  input_schema: {
    type: "object" as const,
    properties: {
      candidates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            workOrderId: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            signals: {
              type: "array",
              items: {
                type: "object",
                properties: { field: { type: "string", enum: ["site", "equipment", "serial", "technician"] }, value: { type: "string" } },
                required: ["field", "value"],
                additionalProperties: false,
              },
            },
          },
          required: ["workOrderId", "confidence", "signals"],
          additionalProperties: false,
        },
      },
      noMatchReason: { type: "string" },
    },
    required: ["candidates"],
    additionalProperties: false,
  },
};

export async function POST() {
  const { workOrders, docs } = loadCase();
  const email = docs.find((d) => d.id === "email")!.text;

  // 1. [rule] An explicit identifier links deterministically; no LLM call.
  const explicitIds = findExplicitIds(email);
  if (explicitIds.length) return Response.json({ source: "rule", explicitIds });

  // 2. [rule] Same customer domain, completed within ±14 days.
  const meta = emailMeta(email);
  const { kept, removed } = prefilterCandidates(meta, workOrders);

  // 3. [LLM] Rank the remaining candidates and cite signals.
  const user = `${doc("email", email)}\n\nCandidate work orders (already filtered by customer and date):\n${doc("work-orders", JSON.stringify(kept, null, 2))}`;
  const result = await callTool<LinkSuggestion>("suggest-links", SYSTEM, user, TOOL);

  // 4. [code] Keep a signal only if its value is in both the email and the work order.
  const candidates = verifySignals(result.data, email, kept);

  // [rule] Every prefiltered work order is shown, even one the model left out.
  for (const w of kept) if (!candidates.some((c) => c.workOrderId === w.id)) candidates.push({ workOrderId: w.id, confidence: "low", signals: [], known: true });

  // 5. [human] The UI asks a person to confirm or reject. Nothing is linked here.
  return Response.json({ source: result.source, note: result.note, explicitIds, meta, removed, kept: kept.map((w) => w.id), raw: result.data, candidates });
}
