import { loadCase } from "@/lib/case";
import { callTool, doc } from "@/lib/llm";
import { evidenceChecks, type Extraction } from "@/lib/checks";

const SYSTEM = `You extract billing evidence for a finance team. Use only the documents provided. Call the record_evidence tool once.
Every value needs a source: the docId of the document, the page number when the document has "--- Page N ---" markers, and a quote copied exactly, character for character, from that document.
Labor: one entry per line of hours stated in the service report, kind "onsite" or "travel". Report totals as written; put any breakdown in note instead of adding separate entries.
Customer confirmation: "confirmed" only for explicit written approval, "conditional" when the approval has conditions, otherwise "not_found".
Do not compare documents or flag differences between them, for example work order hours against report hours; code does that.
Add an ambiguity only when a value is unclear, missing or contradictory in a way that would change the billable hours or whether written approval exists. Leave ambiguities empty otherwise.`;

const REF = {
  type: "object",
  properties: { docId: { type: "string" }, page: { type: "integer" }, quote: { type: "string" } },
  required: ["docId", "quote"],
  additionalProperties: false,
};

const TOOL = {
  name: "record_evidence",
  description: "Record labor hours and customer confirmation, each with a verbatim source quote.",
  input_schema: {
    type: "object" as const,
    properties: {
      laborHours: {
        type: "array",
        items: {
          type: "object",
          properties: {
            hours: { type: "number" },
            date: { type: "string" },
            kind: { type: "string", enum: ["onsite", "travel"] },
            note: { type: "string" },
            source: REF,
          },
          required: ["hours", "date", "kind", "source"],
          additionalProperties: false,
        },
      },
      customerConfirmation: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["confirmed", "conditional", "not_found"] },
          approvedHours: { type: "number" },
          source: REF,
        },
        required: ["status"],
        additionalProperties: false,
      },
      ambiguities: { type: "array", items: { type: "string" } },
    },
    required: ["laborHours", "customerConfirmation", "ambiguities"],
    additionalProperties: false,
  },
};

export async function POST() {
  const { docs } = loadCase();

  // 1. [LLM] Extract to the schema, with a verbatim quote for every value.
  const user = docs.map((d) => doc(d.id, d.text)).join("\n\n");
  const result = await callTool<Extraction>("extract-evidence", SYSTEM, user, TOOL);

  // 2–4. [code] Verify every quote, flag missing fields and ambiguities; pass only if all clear.
  const { checks, pass } = evidenceChecks(result.data, docs);

  return Response.json({ source: result.source, note: result.note, raw: result.data, checks, pass });
}
