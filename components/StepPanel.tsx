"use client";

import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { KIND, DELAY_LABEL, TOTAL_STEPS, type FlowNode } from "@/lib/flow";
import { compareHours, parseQuote, type Check, type EvidenceResponse, type LinkResponse, type Ref } from "@/lib/checks";
import { buildReport, money } from "@/lib/report";
import type { CaseData } from "@/lib/case";
import { ActorIcon, LabelLine } from "./ActorIcon";

export type Session = {
  links?: LinkResponse;
  evidence?: EvidenceResponse;
  decisions: Record<string, "confirmed" | "rejected">; // reviewer's call per candidate work order
  choice?: string;
};
type Props = { node: FlowNode; data: CaseData; session: Session; setSession: Dispatch<SetStateAction<Session>> };

const AI = "var(--color-ai)";
const RULE = "var(--color-rule)";

export default function StepPanel(props: Props) {
  const { node } = props;
  return (
    <aside key={node.id} className="min-h-0 overflow-y-auto border-l border-line bg-surface/50">
      <div className="panel-reveal space-y-8 p-6">
        <StepCard node={node} />
        {node.ai === 1 && <SuggestLinksDemo {...props} />}
        {node.ai === 2 && <ExtractDemo {...props} />}
        {node.step >= 13 && <RuleOutputs {...props} />}
      </div>
    </aside>
  );
}

function StepCard({ node }: { node: FlowNode }) {
  const { icon, actor, color } = KIND[node.kind];
  return (
    <div>
      <p className="text-[13px] font-medium text-muted">
        Step {node.step} of {TOTAL_STEPS}
      </p>
      <h2 className="mt-2 text-lg leading-snug text-balance">
        {node.label.split(" · ").map((line) => (
          <span key={line} className="block">
            <LabelLine line={line} />
          </span>
        ))}
      </h2>
      <div className="mt-4 flex flex-wrap gap-2 text-[13px] font-medium">
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1" style={{ color, borderColor: color }}>
          <ActorIcon actor={icon} /> {actor}
        </span>
        <span className="rounded-full border border-line px-3 py-1 text-muted">
          Delay addressed: {node.delay ? DELAY_LABEL[node.delay] : "none, this is the decision"}
        </span>
      </div>
      <p className="mt-4 max-w-prose text-base leading-relaxed">{node.description}</p>
    </div>
  );
}

// ---- Shared pieces ----------------------------------------------------------

const Label = ({ children }: { children: ReactNode }) => <h3 className="mb-2 text-[13px] font-medium text-muted">{children}</h3>;

const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-lg border border-line bg-surface p-4 ${className}`}>{children}</div>
);

function SourceBadge({ source }: { source: string }) {
  const live = source === "live";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[13px] font-medium" title={live ? "Fresh response from the Claude API" : "Pre-recorded response, used offline or when the API fails"}>
      <span className="size-2 rounded-full" style={{ background: live ? "var(--color-ok)" : "var(--color-muted)" }} />
      {live ? "Live" : source === "rule" ? "Rule" : "Recorded"}
    </span>
  );
}

function RunBar({ title, onRun, loading, result }: { title: string; onRun: () => void; loading: boolean; result?: { source: string; note?: string } }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: AI, background: "color-mix(in srgb, var(--color-ai) 8%, transparent)" }}>
      <div className="flex items-center gap-3">
        <h3 className="flex items-center gap-2 font-medium" style={{ color: AI }}>
          <ActorIcon actor="ai" /> {title}
        </h3>
        {result && <SourceBadge source={result.source} />}
        <button
          className="btn ml-auto rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ borderColor: AI, color: AI }}
          onClick={onRun}
          disabled={loading}
        >
          {loading ? "Reading documents…" : result ? "Run again" : "Run AI"}
        </button>
      </div>
      {result?.note && <p className="mt-2 text-[13px] text-muted">{result.note}</p>}
    </div>
  );
}

function RawJson({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  if (value === undefined) return null;
  return (
    <div>
      <button className="text-[13px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => setOpen(!open)}>
        {open ? "Hide raw JSON" : "Raw JSON"}
      </button>
      {open && <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-line bg-bg p-3 font-mono text-[13px] leading-relaxed">{JSON.stringify(value, null, 2)}</pre>}
    </div>
  );
}

function CheckList({ items, title = "Checks in code" }: { items: Check[]; title?: string }) {
  return (
    <div>
      <Label>{title}</Label>
      <ul className="space-y-1.5 text-[15px]">
        {items.map((c, i) => (
          <li key={i} className="flex gap-2">
            <span style={{ color: c.ok ? "var(--color-ok)" : "var(--color-warn)" }}>{c.ok ? "✓" : "⚠"}</span>
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Renders a document with every occurrence of the given phrases highlighted.
function DocText({ text, marks, id }: { text: string; marks: { phrase: string; color: string }[]; id?: string }) {
  const box = useRef<HTMLPreElement>(null);
  const markKey = marks.map((m) => m.phrase).join("|");
  // Bring the first highlight into view inside the box (not the page).
  useEffect(() => {
    const first = box.current?.querySelector("mark");
    if (box.current && first) box.current.scrollTo({ top: first.offsetTop - 48, behavior: "smooth" });
  }, [markKey, text]);
  const ranges: { start: number; end: number; color: string }[] = [];
  for (const m of marks) {
    const words = m.phrase.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    for (const hit of text.matchAll(new RegExp(words.map(escape).join("\\s+"), "gi"))) {
      ranges.push({ start: hit.index, end: hit.index + hit[0].length, color: m.color });
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start < at) continue;
    parts.push(text.slice(at, r.start));
    parts.push(
      <mark key={r.start} className="rounded-sm text-ink" style={{ background: `color-mix(in srgb, ${r.color} 32%, transparent)` }}>
        {text.slice(r.start, r.end)}
      </mark>,
    );
    at = r.end;
  }
  parts.push(text.slice(at));
  return (
    <pre ref={box} id={id} className="relative max-h-96 overflow-auto rounded-lg border border-line bg-bg p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
      {parts}
    </pre>
  );
}

function RefChip({ r, onClick }: { r: Ref; onClick?: () => void }) {
  return (
    <button className="shrink-0 rounded-md border border-line px-2 py-0.5 font-mono text-[13px] whitespace-nowrap text-muted hover:border-muted hover:text-ink" onClick={onClick} title={r.quote}>
      {r.docId}
      {r.page ? ` p.${r.page}` : ""}
    </button>
  );
}

function useRun<T>(url: string, onDone: (r: T) => void) {
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      onDone(await (await fetch(url, { method: "POST" })).json());
    } finally {
      setLoading(false);
    }
  };
  return { loading, run };
}

// ---- AI #1: suggest candidate links ----------------------------------------

function SuggestLinksDemo({ data, session, setSession }: Props) {
  const r = session.links;
  const { loading, run } = useRun<LinkResponse>("/api/suggest-links", (links) => setSession((s) => ({ ...s, links, decisions: {} })));
  const email = data.docs.find((d) => d.id === "email")!.text;
  const marks = (r?.candidates ?? []).flatMap((c) => c.signals.filter((s) => s.verified).map((s) => ({ phrase: s.value, color: AI })));

  const checks: Check[] = r
    ? [
        r.explicitIds.length
          ? { ok: true, label: `Explicit identifier found (${r.explicitIds.join(", ")}): linked by rule, no AI call.` }
          : { ok: false, label: "No WO, PO or Q number in the email. Rules can't link it, so AI suggests candidates." },
        ...(r.removed ?? []).map((x) => ({ ok: true, label: `Prefilter removed ${x.id}: ${x.reason}.` })),
        { ok: true, label: `Prefilter kept ${r.kept?.join(", ")}: same customer, completed within 14 days.` },
        ...(r.candidates ?? []).flatMap((c) => [
          ...(c.known ? [] : [{ ok: false, label: `${c.workOrderId} was not in the prefiltered list.` }]),
          ...c.signals.map((s) => ({
            ok: s.verified,
            label: s.verified
              ? `${c.workOrderId} ${s.field} “${s.value}” appears in the email and the work order.`
              : `${c.workOrderId} ${s.field} “${s.value}” is not written in both the email and the work order. Dropped.`,
          })),
        ]),
        Object.keys(session.decisions).length
          ? { ok: true, label: `Reviewer decided: ${Object.entries(session.decisions).map(([id, d]) => `${id} ${d}`).join(", ")}.` }
          : { ok: false, label: "Waiting for a reviewer. AI never links records on its own." },
      ]
    : [];

  return (
    <section className="space-y-6">
      <RunBar title="AI #1: Suggest candidate links" onRun={run} loading={loading} result={r} />
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label>Unlinked record: customer email</Label>
            <DocText text={email} marks={marks} />
          </div>
          <div>
            <Label>Work orders on file</Label>
            <ul className="space-y-1 font-mono text-[13px]">
              {data.workOrders.map((w) => {
                const removed = r?.removed?.find((x) => x.id === w.id);
                return (
                  <li key={w.id} className={removed ? "text-muted line-through" : ""}>
                    {w.id} · {w.customer} · {w.site} · {w.equipment} · {w.completed}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="space-y-3">
          <Label>Suggested links</Label>
          {!r && <p className="text-[15px] text-muted">Run AI to rank the candidate work orders.</p>}
          {r?.raw?.noMatchReason && <Card>No match: {r.raw.noMatchReason}</Card>}
          {r?.candidates?.map((c) => {
            const wo = data.workOrders.find((w) => w.id === c.workOrderId);
            const decided = session.decisions[c.workOrderId];
            const decide = (d: "confirmed" | "rejected") => setSession((s) => ({ ...s, decisions: { ...s.decisions, [c.workOrderId]: d } }));
            return (
              <Card key={c.workOrderId}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono font-medium">{c.workOrderId}</span>
                  <span className="rounded-full border px-2.5 py-0.5 text-[13px] font-medium" style={{ borderColor: AI, color: AI, opacity: c.confidence === "low" ? 0.6 : 1 }}>
                    {c.confidence} confidence
                  </span>
                </div>
                {wo && <p className="mt-1 text-[13px] text-muted">{[wo.site, wo.equipment, wo.technician].join(" · ")}</p>}
                <ul className="mt-3 space-y-1 text-[13px]">
                  {c.signals.map((s, j) => (
                    <li key={j} className={s.verified ? "" : "text-muted line-through"}>
                      <span style={{ color: s.verified ? "var(--color-ok)" : "var(--color-warn)" }}>{s.verified ? "✓" : "⚠"}</span> {s.field}: {s.value}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center gap-2">
                    {decided ? (
                      <span className="text-[13px] font-medium" style={{ color: "var(--color-human)" }}>
                        <ActorIcon actor="human" /> {decided === "confirmed" ? "Confirmed by reviewer" : "Rejected by reviewer"}
                      </span>
                    ) : (
                      <>
                        <button className="btn rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink" onClick={() => decide("confirmed")}>
                          Confirm link
                        </button>
                        <button className="btn rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:border-muted" onClick={() => decide("rejected")}>
                          Reject
                        </button>
                      </>
                    )}
                  </div>
              </Card>
            );
          })}
          <RawJson value={r?.raw} />
        </div>
      </div>
      {r && <CheckList items={checks} />}
    </section>
  );
}

// ---- AI #2: extract evidence with references --------------------------------

function ExtractDemo({ data, session, setSession }: Props) {
  const r = session.evidence;
  const { loading, run } = useRun<EvidenceResponse>("/api/extract-evidence", (evidence) => setSession((s) => ({ ...s, evidence })));
  const [tab, setTab] = useState("service-report");
  const refs: Ref[] = r ? [...r.raw.laborHours.map((l) => l.source), ...(r.raw.customerConfirmation.source ? [r.raw.customerConfirmation.source] : [])] : [];
  const current = data.docs.find((d) => d.id === tab)!;
  const conf = r?.raw.customerConfirmation;

  return (
    <section className="space-y-6">
      <RunBar title="AI #2: Extract evidence with references" onRun={run} loading={loading} result={r} />
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label>Linked bundle</Label>
          <div className="mb-2 flex flex-wrap gap-1">
            {data.docs.map((d) => {
              const n = refs.filter((x) => x.docId === d.id).length;
              return (
                <button
                  key={d.id}
                  className={`rounded-md border px-2.5 py-1 text-[13px] font-medium ${tab === d.id ? "border-muted text-ink" : "border-line text-muted hover:text-ink"}`}
                  onClick={() => setTab(d.id)}
                >
                  {d.title}
                  {n > 0 && <span style={{ color: AI }}> · {n}</span>}
                </button>
              );
            })}
          </div>
          <DocText text={current.text} marks={refs.filter((x) => x.docId === tab).map((x) => ({ phrase: x.quote, color: AI }))} />
        </div>
        <div className="space-y-3">
          <Label>Extracted evidence</Label>
          {!r && <p className="text-[15px] text-muted">Run AI to extract hours and customer confirmation.</p>}
          {r && (
            <>
              {r.raw.laborHours.map((l, i) => (
                <Card key={i}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-medium tabular-nums">{l.hours.toFixed(1)} h</span>
                    <span className="text-[13px] text-muted">
                      {l.kind === "onsite" ? "On-site" : "Travel"} · {l.date}
                    </span>
                  </div>
                  {l.note && <p className="mt-1 text-[13px] text-muted">{l.note}</p>}
                  <Quote r={l.source} onOpen={() => setTab(l.source.docId)} />
                </Card>
              ))}
              {conf && (
                <Card>
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">Customer confirmation</span>
                    <span className="text-[13px] font-medium" style={{ color: conf.status === "confirmed" ? "var(--color-ok)" : "var(--color-warn)" }}>
                      {conf.status.replace("_", " ")}
                      {conf.approvedHours !== undefined && ` · ${conf.approvedHours.toFixed(1)} h approved`}
                    </span>
                  </div>
                  {conf.source && <Quote r={conf.source} onOpen={() => setTab(conf.source!.docId)} />}
                </Card>
              )}
              <Card>
                <span className="font-medium">Ambiguities</span>
                {r.raw.ambiguities.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">{r.raw.ambiguities.map((a, i) => <li key={i}>{a}</li>)}</ul>
                ) : (
                  <p className="mt-1 text-[15px] text-muted">None reported.</p>
                )}
              </Card>
              <RawJson value={r.raw} />
            </>
          )}
        </div>
      </div>
      {r && (
        <>
          <CheckList items={r.checks} />
          <p className="text-[15px] font-medium">
            Evidence checks pass?{" "}
            <span style={{ color: r.pass ? "var(--color-ok)" : "var(--color-warn)" }}>
              {r.pass ? "Yes. Continue to the hours comparison (step 13)." : "No. A person verifies the flagged values (step 12)."}
            </span>
          </p>
        </>
      )}
    </section>
  );
}

function Quote({ r, onOpen }: { r: Ref; onOpen: () => void }) {
  return (
    <div className="mt-3 flex items-start gap-2">
      <RefChip r={r} onClick={onOpen} />
      <q className="text-[13px] leading-relaxed text-muted italic">{r.quote}</q>
    </div>
  );
}

// ---- Rule outputs: steps 13–15 ----------------------------------------------

function RuleOutputs({ node, data, session, setSession }: Props) {
  const x = session.evidence?.raw ?? data.recordedEvidence;
  const source = session.evidence?.source ?? "recorded";
  const quote = parseQuote(data.docs.find((d) => d.id === "quote")!.text);
  const cmp = compareHours(data.workOrder, x, quote);
  const report = buildReport({ wo: data.workOrder, x, cmp, docs: data.docs, emailLink: session.decisions[data.workOrder.id] });
  const [openDoc, setOpenDoc] = useState<string | null>(null);

  const allRefs = [...report.links, ...report.findings].flatMap((l) => l.refs);
  const show = (docId: string) => {
    setOpenDoc(docId);
    setTimeout(() => document.getElementById(`src-${docId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  };

  const comparison = (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Label>Hours comparison (rule, tolerance 0.25 h)</Label>
        <span className="mb-2 text-[13px] text-muted">
          Using AI #2 output: <SourceBadge source={source} />
        </span>
      </div>
      <table className="w-full text-[15px]">
        <tbody>
          {cmp.rows.map((row) => (
            <tr key={row.source} className="border-b border-line">
              <td className="py-2">{row.source}</td>
              <td className="py-2 text-right font-mono tabular-nums">{row.hours.toFixed(1)} h</td>
            </tr>
          ))}
          <tr>
            <td className="py-2 font-medium">Supported for billing</td>
            <td className="py-2 text-right font-mono font-medium tabular-nums">{cmp.supported.toFixed(1)} h</td>
          </tr>
        </tbody>
      </table>
      <CheckList title="Flags" items={cmp.flags.map((f) => ({ ok: f.level === "ok", label: f.text }))} />
    </section>
  );

  if (node.step === 13) return comparison;

  return (
    <section className="space-y-6">
      <div className="rounded-lg border p-5" style={{ borderColor: RULE }}>
        <p className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: RULE }}>
          <ActorIcon actor="rule" /> Report from template · AI #2 output: {source}
        </p>
        <h3 className="mt-2 font-medium">{report.title}</h3>
        <p className="mt-1 text-[15px]" style={{ color: cmp.unapproved > 0 ? "var(--color-warn)" : "var(--color-ok)" }}>
          {report.status}
        </p>

        {[
          ["Record links", report.links],
          ["Findings", report.findings],
        ].map(([title, lines]) => (
          <div key={title as string} className="mt-5">
            <Label>{title as string}</Label>
            <ul className="space-y-2 text-[15px]">
              {(lines as typeof report.findings).map((l, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-2">
                  {l.warn && <span style={{ color: "var(--color-warn)" }}>⚠</span>}
                  <span>{l.text}</span>
                  {l.refs.map((r, j) => (
                    <RefChip key={j} r={r} onClick={() => show(r.docId)} />
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="mt-5">
          <CheckList title="Flags" items={report.flags.map((f) => ({ ok: f.level === "ok", label: f.text }))} />
        </div>
      </div>

      {node.step === 15 && (
        <div>
          <Label>
            <span className="flex items-center gap-1.5">
              <ActorIcon actor="human" color="var(--color-human)" /> Options for the reviewer. The system does not choose.
            </span>
          </Label>
          <div className="grid grid-cols-2 gap-3">
            {report.options.map((o) => {
              const chosen = session.choice === o.id;
              return (
                <button
                  key={o.id}
                  className="btn flex flex-col items-start rounded-lg border p-4 text-left"
                  style={{ borderColor: chosen ? "var(--color-human)" : "var(--color-line)", background: chosen ? "color-mix(in srgb, var(--color-human) 10%, transparent)" : undefined }}
                  onClick={() => setSession((s) => ({ ...s, choice: o.id }))}
                >
                  <span className="block font-medium">{o.label}</span>
                  <span className="mt-1 block font-mono text-lg tabular-nums">{money(o.amount)}</span>
                  <span className="mt-1 block text-[13px] text-muted">{o.detail}</span>
                  {chosen && (
                    <span className="mt-2 block text-[13px] font-medium" style={{ color: "var(--color-human)" }}>
                      Chosen by the reviewer
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <Label>Sources</Label>
        <div className="space-y-2">
          {data.docs
            .filter((d) => allRefs.some((r) => r.docId === d.id))
            .map((d) => (
              <details key={d.id} open={openDoc === d.id} onToggle={(e) => setOpenDoc(e.currentTarget.open ? d.id : openDoc === d.id ? null : openDoc)} className="rounded-lg border border-line">
                <summary className="cursor-pointer px-3 py-2 text-[15px]">{d.title}</summary>
                <div className="px-3 pb-3">
                  <DocText id={`src-${d.id}`} text={d.text} marks={allRefs.filter((r) => r.docId === d.id).map((r) => ({ phrase: r.quote, color: d.id === "quote" || d.id === "work-order" ? RULE : AI }))} />
                </div>
              </details>
            ))}
        </div>
      </div>

    </section>
  );
}
