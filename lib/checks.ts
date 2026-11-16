// Deterministic rules. The LLM never decides anything checked here.

export type WorkOrder = {
  id: string;
  customer: string;
  contactDomain: string;
  site: string;
  equipment: string;
  serial: string;
  technician: string;
  completed: string;
  laborHours: number;
  quoteRef: string;
  status: string;
};

export type Doc = { id: string; title: string; text: string };

export type Signal = { field: string; value: string };
export type Candidate = { workOrderId: string; confidence: "high" | "medium" | "low"; signals: Signal[] };
export type LinkSuggestion = { candidates: Candidate[]; noMatchReason?: string };

export type Ref = { docId: string; page?: number; quote: string };
export type Extraction = {
  laborHours: { hours: number; date: string; kind: "onsite" | "travel"; note?: string; source: Ref }[];
  customerConfirmation: { status: "confirmed" | "conditional" | "not_found"; approvedHours?: number; source?: Ref };
  ambiguities: string[];
};

export type Check = { ok: boolean; label: string; detail?: string };

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

// ---- AI #1 pipeline -------------------------------------------------------

export const findExplicitIds = (text: string) => [...new Set(text.match(/\b(WO|PO|Q)-\d{4}\b/g) ?? [])];

export function emailMeta(text: string) {
  const domain = text.match(/^From:.*@([\w.-]+)/m)?.[1] ?? "";
  const date = text.match(/^Date:\s*(\d{4}-\d{2}-\d{2})/m)?.[1] ?? "";
  return { domain, date };
}

const DAY = 86_400_000;

export function prefilterCandidates(record: { domain: string; date: string }, workOrders: WorkOrder[]) {
  const kept: WorkOrder[] = [];
  const removed: { id: string; reason: string }[] = [];
  for (const wo of workOrders) {
    const days = Math.abs(Date.parse(wo.completed) - Date.parse(record.date)) / DAY;
    if (wo.contactDomain !== record.domain) removed.push({ id: wo.id, reason: `customer domain ${wo.contactDomain} ≠ ${record.domain}` });
    else if (!(days <= 14)) removed.push({ id: wo.id, reason: `completed ${days.toFixed(0)} days from email` });
    else kept.push(wo);
  }
  return { kept, removed };
}

// Keep a signal only if its value appears in the record text AND in the candidate.
export function verifySignals(suggestion: LinkSuggestion, recordText: string, candidates: WorkOrder[]) {
  return suggestion.candidates.map((c) => {
    const wo = candidates.find((w) => w.id === c.workOrderId);
    const signals = c.signals.map((s) => {
      const field = wo?.[s.field as keyof WorkOrder];
      const woText = field !== undefined ? String(field) : wo ? Object.values(wo).join(" ") : "";
      const v = norm(s.value);
      return { ...s, verified: !!wo && !!v && norm(recordText).includes(v) && norm(woText).includes(v) };
    });
    return { ...c, known: !!wo, signals };
  });
}

// ---- AI #2 pipeline -------------------------------------------------------

function pageText(text: string, page: number) {
  const parts = text.split(/--- Page (\d+) ---/);
  const i = parts.indexOf(String(page));
  return i === -1 ? null : parts[i + 1];
}

export function verifyQuote(ref: Ref, docs: Doc[]): Check {
  const doc = docs.find((d) => d.id === ref.docId);
  const where = `${ref.docId}${ref.page ? ` p.${ref.page}` : ""}`;
  if (!doc) return { ok: false, label: `Quote cites unknown document "${ref.docId}"` };
  const scope = ref.page ? pageText(doc.text, ref.page) : doc.text;
  if (scope === null) return { ok: false, label: `Page ${ref.page} not found in ${ref.docId}` };
  const ok = !!norm(ref.quote) && norm(scope).includes(norm(ref.quote));
  return { ok, label: ok ? `Quote found verbatim in ${where}` : `Quote not found in ${where}`, detail: ref.quote };
}

// Extraction issues (unverifiable quotes) and ambiguity (missing fields, model-reported doubts).
export function evidenceChecks(x: Extraction, docs: Doc[]) {
  const checks: Check[] = [];
  for (const h of x.laborHours) {
    const q = verifyQuote(h.source, docs);
    checks.push({ ...q, label: `${h.hours} h ${h.kind}: ${q.label}` });
  }
  if (!x.laborHours.some((h) => h.kind === "onsite")) checks.push({ ok: false, label: "Ambiguity: no on-site hours found" });

  const c = x.customerConfirmation;
  if (c.status === "not_found") checks.push({ ok: false, label: "Ambiguity: no customer confirmation found" });
  else if (!c.source) checks.push({ ok: false, label: `Confirmation "${c.status}" has no source reference` });
  else {
    const q = verifyQuote(c.source, docs);
    checks.push({ ...q, label: `Confirmation: ${q.label}` });
  }
  if (c.status === "confirmed" && c.approvedHours === undefined) checks.push({ ok: false, label: "Ambiguity: confirmation without approved hours" });

  for (const a of x.ambiguities) checks.push({ ok: false, label: `Ambiguity reported: ${a}` });
  if (x.ambiguities.length === 0) checks.push({ ok: true, label: "No ambiguities reported" });

  return { checks, pass: checks.every((k) => k.ok) };
}

// ---- Hours comparison -----------------------------------------------------

export function parseQuote(text: string) {
  const num = (re: RegExp) => Number(text.match(re)?.[1] ?? NaN);
  return {
    id: text.match(/\bQ-\d{4}\b/)?.[0] ?? "",
    hours: num(/Labor:\s*([\d.]+)\s*h/),
    rate: num(/at \$(\d+)\/h/),
    travelFee: num(/\$(\d+) flat fee/),
  };
}

export type Flag = { level: "warn" | "ok"; text: string };
const TOLERANCE = 0.25;
const h = (n: number) => `${n.toFixed(1)} h`;

export function compareHours(wo: WorkOrder, x: Extraction, quote: ReturnType<typeof parseQuote>) {
  const onsite = x.laborHours.filter((l) => l.kind === "onsite").reduce((s, l) => s + l.hours, 0);
  const travel = x.laborHours.filter((l) => l.kind === "travel").reduce((s, l) => s + l.hours, 0);
  const conf = x.customerConfirmation;
  const approved = conf.status === "confirmed" ? (conf.approvedHours ?? 0) : 0;

  const overQuote = Math.max(0, onsite - quote.hours);
  const unapproved = Math.max(0, overQuote - approved);
  const supported = onsite - unapproved;

  const flags: Flag[] = [];
  const woGap = onsite - wo.laborHours;
  if (Math.abs(woGap) > TOLERANCE)
    flags.push({ level: "warn", text: `Service report on-site hours (${h(onsite)}) differ from work order ${wo.id} (${h(wo.laborHours)}) by ${h(Math.abs(woGap))}.` });
  if (conf.status === "not_found" && overQuote > 0) flags.push({ level: "warn", text: "No customer confirmation found for hours over the quote." });
  if (conf.status === "conditional") flags.push({ level: "warn", text: "Customer confirmation is conditional; it is not counted as approval." });
  if (approved > 0)
    flags.push({ level: "ok", text: `${h(Math.min(approved, overQuote))} over the quote is covered by written customer approval.` });
  if (unapproved > 0)
    flags.push({ level: "warn", text: `${h(unapproved)} over quote ${quote.id} (${h(quote.hours)}) has no written approval. The quote requires written approval for additional labor.` });
  if (travel > 0) flags.push({ level: "ok", text: `Travel (${h(travel)}) excluded from labor; quote bills travel as a flat fee.` });

  return {
    rows: [
      { source: `Quote ${quote.id}`, hours: quote.hours },
      { source: `Work order ${wo.id}`, hours: wo.laborHours },
      { source: "Service report (on-site)", hours: onsite },
      { source: "Written approval (email)", hours: approved },
    ],
    flags,
    onsite,
    travel,
    supported,
    unapproved,
    quote,
  };
}

// ---- API response shapes (shared by routes and UI) ------------------------

export type VerifiedCandidate = ReturnType<typeof verifySignals>[number];
export type LinkResponse = {
  source: "live" | "recorded" | "rule";
  note?: string;
  explicitIds: string[];
  meta?: { domain: string; date: string };
  removed?: { id: string; reason: string }[];
  kept?: string[];
  raw?: LinkSuggestion;
  candidates?: VerifiedCandidate[];
};
export type EvidenceResponse = { source: "live" | "recorded"; note?: string; raw: Extraction; checks: Check[]; pass: boolean };
