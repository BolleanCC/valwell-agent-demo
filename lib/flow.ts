export type Kind = "rule" | "ai" | "human" | "decision";
export type Delay = "search" | "wait" | null;
type Side = "t" | "b" | "l" | "r";

export type FlowNode = {
  id: string;
  label: string;
  kind: Kind;
  step: number;
  delay: Delay;
  main: boolean;
  ai?: 1 | 2;
  x: number;
  y: number;
  description: string;
};

export type FlowEdge = {
  source: string;
  target: string;
  label?: string;
  sh: Side; // source side
  th: Side; // target side
};

const COL = { left: -340, main: 0, right: 340, far: 660 };
const row = (i: number) => i * 130;

export const nodes: FlowNode[] = [
  {
    id: "collect", step: 1, kind: "rule", delay: "search", main: true, x: COL.main, y: row(0),
    label: "Collect work order, service report, and emails",
    description: "Pull every record for the job into one place, so Finance stops searching across the operational system, shared drives and inboxes.",
  },
  {
    id: "readable", step: 2, kind: "decision", delay: "search", main: true, x: COL.main, y: row(1),
    label: "Records accessible and readable?",
    description: "A simple rule checks that each file opens and contains text. Nothing downstream should run on a document nobody can read.",
  },
  {
    id: "resolveAccess", step: 3, kind: "human", delay: "wait", main: false, x: COL.left, y: row(1),
    label: "Resolve access issues or provide readable copies",
    description: "A person fixes permissions or supplies a clean copy. This is waiting time, so it is raised the moment a file fails to open.",
  },
  {
    id: "match", step: 4, kind: "ai", ai: 1, delay: "search", main: true, x: COL.main, y: row(2),
    label: "⚙️ Match explicit identifiers · 🤖 Suggest matches when identifiers are missing",
    description: "Rules link records that quote a WO, PO or quote number. Only when no identifier exists does AI read the text and suggest likely work orders, with evidence.",
  },
  {
    id: "clearMatch", step: 5, kind: "decision", delay: "search", main: true, x: COL.main, y: row(3),
    label: "Clear match?",
    description: "Yes only when an explicit identifier matched. An AI suggestion is never treated as a clear match, however confident it looks.",
  },
  {
    id: "reviewCandidates", step: 6, kind: "human", delay: "search", main: false, x: COL.right, y: row(3),
    label: "Review candidate matches",
    description: "A person confirms or rejects the AI's ranked candidates. Each one shows the verified signals behind it, so the decision takes seconds.",
  },
  {
    id: "awaitClarification", step: 7, kind: "human", delay: "wait", main: false, x: COL.far, y: row(3),
    label: "Await clarification",
    description: "If no candidate fits, the job is parked with one clear question for the customer or field team. Nobody guesses.",
  },
  {
    id: "recordsPresent", step: 8, kind: "decision", delay: "search", main: true, x: COL.main, y: row(4),
    label: "Required records present?",
    description: "A checklist rule confirms the bundle has a work order, a service report, customer correspondence and the commercial terms.",
  },
  {
    id: "listMissing", step: 9, kind: "human", delay: "wait", main: false, x: COL.left, y: row(4),
    label: "⚙️ List missing records · 👤 Obtain missing records",
    description: "The system lists exactly what is missing; a person chases it. Making the gap explicit shortens the wait.",
  },
  {
    id: "extract", step: 10, kind: "ai", ai: 2, delay: "search", main: true, x: COL.main, y: row(5),
    label: "🤖 Extract hours and customer confirmation · Include source references",
    description: "AI reads the report and emails and returns hours and confirmation as structured data. Every value must cite a verbatim quote that code then checks.",
  },
  {
    id: "evidenceChecks", step: 11, kind: "decision", delay: "search", main: true, x: COL.main, y: row(6),
    label: "Evidence checks pass?",
    description: "Passes only if every quote was found in its source and nothing is missing or ambiguous. The model cannot pass its own work.",
  },
  {
    id: "verifyEvidence", step: 12, kind: "human", delay: "wait", main: false, x: COL.right, y: row(6),
    label: "Verify evidence or request clarification",
    description: "A person looks at the flagged values against the source, corrects them or asks the field team, then extraction reruns.",
  },
  {
    id: "compare", step: 13, kind: "rule", delay: "search", main: true, x: COL.main, y: row(7),
    label: "Compare equivalent hours · Flag discrepancies and missing confirmation",
    description: "Code compares work order, service report and quote hours, and flags any gap or any hours over the quote without written approval.",
  },
  {
    id: "compile", step: 14, kind: "rule", delay: "search", main: true, x: COL.main, y: row(8),
    label: "Compile findings and source links · Summarize findings (template)",
    description: "A fixed template turns the checked results into a short report with links to each source. No AI is needed to write it.",
  },
  {
    id: "finalReview", step: 15, kind: "human", delay: null, main: true, x: COL.main, y: row(9),
    label: "Review report and supporting evidence · Decide the next step",
    description: "Finance reads one report instead of four systems and makes the billing decision. The accountable call stays with a person.",
  },
];

export const edges: FlowEdge[] = [
  { source: "collect", target: "readable", sh: "b", th: "t" },
  { source: "readable", target: "match", label: "Yes", sh: "b", th: "t" },
  { source: "readable", target: "resolveAccess", label: "No", sh: "l", th: "r" },
  { source: "resolveAccess", target: "collect", label: "Ready", sh: "t", th: "l" },
  { source: "match", target: "clearMatch", sh: "b", th: "t" },
  { source: "clearMatch", target: "recordsPresent", label: "Yes", sh: "b", th: "t" },
  { source: "clearMatch", target: "reviewCandidates", label: "No", sh: "r", th: "l" },
  { source: "reviewCandidates", target: "recordsPresent", label: "Confirmed", sh: "b", th: "r" },
  { source: "reviewCandidates", target: "awaitClarification", label: "Unresolved", sh: "r", th: "l" },
  { source: "recordsPresent", target: "extract", label: "Yes", sh: "b", th: "t" },
  { source: "recordsPresent", target: "listMissing", label: "No", sh: "l", th: "r" },
  { source: "listMissing", target: "collect", label: "Received", sh: "l", th: "l" },
  { source: "extract", target: "evidenceChecks", sh: "b", th: "t" },
  { source: "evidenceChecks", target: "compare", label: "Yes", sh: "b", th: "t" },
  { source: "evidenceChecks", target: "verifyEvidence", label: "No", sh: "r", th: "l" },
  { source: "verifyEvidence", target: "extract", label: "Clarified", sh: "t", th: "r" },
  { source: "compare", target: "compile", sh: "b", th: "t" },
  { source: "compile", target: "finalReview", sh: "b", th: "t" },
];

export const TOTAL_STEPS = nodes.length;

// `icon` names the line icon in components/ActorIcon.tsx.
export const KIND: Record<Kind, { icon: "rule" | "ai" | "human"; actor: string; color: string }> = {
  rule: { icon: "rule", actor: "Rule (automated)", color: "var(--color-rule)" },
  decision: { icon: "rule", actor: "Rule-based decision", color: "var(--color-rule)" },
  ai: { icon: "ai", actor: "AI reads, code checks", color: "var(--color-ai)" },
  human: { icon: "human", actor: "Human", color: "var(--color-human)" },
};

export const DELAY_LABEL: Record<"search" | "wait", string> = { search: "Search & check", wait: "Waiting" };

const stepOf = new Map(nodes.map((n) => [n.id, n.step]));
const mainIds = new Set(nodes.filter((n) => n.main).map((n) => n.id));

// An edge appears once both ends are revealed: with its target, or with its
// source when the target came earlier (loops).
export const edgeVisibleAt = (e: FlowEdge, step: number) =>
  Math.max(stepOf.get(e.source)!, stepOf.get(e.target)!) <= step;

export const isMainEdge = (e: FlowEdge) => mainIds.has(e.source) && mainIds.has(e.target);
