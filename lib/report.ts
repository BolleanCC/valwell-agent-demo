// The final report is a fixed template filled from checked results. No LLM involved.
import type { Doc, Extraction, Ref, WorkOrder, compareHours } from "./checks";

type Comparison = ReturnType<typeof compareHours>;
export type Line = { text: string; refs: Ref[]; warn?: boolean };
export type Option = { id: string; label: string; detail: string; amount: number };

const h = (n: number) => `${n.toFixed(1)} h`;
export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// A reference to the whole line of a document that contains `text`.
function lineRef(docs: Doc[], docId: string, text: string): Ref[] {
  const line = docs.find((d) => d.id === docId)?.text.split("\n").find((l) => l.includes(text));
  return line ? [{ docId, quote: line.trim() }] : [];
}

export function buildReport(args: {
  wo: WorkOrder;
  x: Extraction;
  cmp: Comparison;
  docs: Doc[];
  emailLink: "confirmed" | "rejected" | undefined;
}) {
  const { wo, x, cmp, docs, emailLink } = args;
  const { quote, onsite, travel, supported, unapproved } = cmp;
  const conf = x.customerConfirmation;
  const sources = (kind: "onsite" | "travel") => x.laborHours.filter((l) => l.kind === kind).map((l) => l.source);

  const links: Line[] = [
    { text: `Service report → ${wo.id}: explicit identifier in the report.`, refs: lineRef(docs, "service-report", wo.id) },
    {
      text:
        emailLink === "confirmed" ? `Customer email → ${wo.id}: AI suggestion, confirmed by a reviewer.`
        : emailLink === "rejected" ? `Customer email → ${wo.id}: AI suggestion rejected by a reviewer. Do not rely on this email.`
        : `Customer email → ${wo.id}: AI suggestion, not yet confirmed by a reviewer.`,
      refs: [],
      warn: emailLink !== "confirmed",
    },
  ];

  const findings: Line[] = [
    { text: `On-site labor: ${h(onsite)} on the service report.`, refs: sources("onsite") },
    { text: `Work order ${wo.id} records ${h(wo.laborHours)}.`, refs: lineRef(docs, "work-order", "laborHours") },
    { text: `Quote ${quote.id}: ${h(quote.hours)} at ${money(quote.rate)}/h. Additional labor needs written approval.`, refs: [...lineRef(docs, "quote", "Labor:"), ...lineRef(docs, "quote", "Additional labor")] },
    conf.status === "confirmed"
      ? { text: `Written customer approval for ${h(conf.approvedHours ?? 0)} of additional labor.`, refs: conf.source ? [conf.source] : [] }
      : { text: `No written customer approval found (${conf.status.replace("_", " ")}).`, refs: conf.source ? [conf.source] : [], warn: true },
    { text: `Travel: ${h(travel)} on the report, billed as a ${money(quote.travelFee)} flat fee per the quote.`, refs: [...sources("travel"), ...lineRef(docs, "quote", "flat fee")] },
  ];

  const bill = (hours: number) => hours * quote.rate + quote.travelFee;
  const options: Option[] =
    unapproved > 0
      ? [
          { id: "bill-supported", label: `Bill ${h(supported)} now`, detail: `${h(supported)} × ${money(quote.rate)} + ${money(quote.travelFee)} travel. Hold ${h(unapproved)} until approved.`, amount: bill(supported) },
          { id: "seek-approval", label: `Ask ${wo.customer} to approve ${h(unapproved)}`, detail: `Then bill ${h(onsite)} × ${money(quote.rate)} + ${money(quote.travelFee)} travel.`, amount: bill(onsite) },
        ]
      : [{ id: "bill-all", label: `Bill ${h(onsite)}`, detail: `${h(onsite)} × ${money(quote.rate)} + ${money(quote.travelFee)} travel.`, amount: bill(onsite) }];

  return {
    title: `${wo.id} · ${wo.customer} · ${wo.site}`,
    status: unapproved > 0 ? `Needs a decision: ${h(unapproved)} has no written approval` : "Supported in full",
    links,
    findings,
    flags: cmp.flags,
    options,
  };
}
