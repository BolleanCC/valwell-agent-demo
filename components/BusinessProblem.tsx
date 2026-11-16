"use client";

import { useRef, useState } from "react";
import type { Doc } from "@/lib/checks";

// What each record is, where it lives, what Finance needs from it, and the catch.
const CARDS: Record<string, { system: string; holds: string; catch: string }> = {
  "work-order": {
    system: "Operational system",
    holds: "Records 6.5 h of labor for the Pad 12 triplex pump.",
    catch: "Says nothing about the extra seal work.",
  },
  "service-report": {
    system: "PDF from the field",
    holds: "8.0 h on site, 2.0 h travel. Seal replaced after on-site approval.",
    catch: "Hours differ from the work order and the quote.",
  },
  email: {
    system: "Finance inbox",
    holds: "The customer approves the extra 1.5 h in writing.",
    catch: "No work order number anywhere.",
  },
  quote: {
    system: "Quoting system",
    holds: "6.0 h at $145/h, travel as a $350 flat fee.",
    catch: "Extra labor needs written approval.",
  },
};

export default function BusinessProblem({ docs }: { docs: Doc[] }) {
  const [open, setOpen] = useState(true);
  const [viewing, setViewing] = useState<Doc | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const show = (d: Doc) => {
    setViewing(d);
    dialog.current?.showModal();
  };

  if (!open) {
    return (
      <div className="flex items-center gap-3 border-b border-line px-6 py-2 text-[13px] text-muted">
        <span>The business problem: a finished repair job that Finance can’t bill yet.</span>
        <button className="font-medium text-ink underline-offset-4 hover:underline" onClick={() => setOpen(true)}>
          Show
        </button>
      </div>
    );
  }

  return (
    <section className="grid grid-cols-[minmax(0,380px)_1fr] gap-6 border-b border-line bg-surface/40 px-6 py-4" aria-label="The business problem">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-medium">The business problem</h2>
          <button className="text-[13px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => setOpen(false)}>
            Hide
          </button>
        </div>
        <p className="mt-2 text-[15px] leading-relaxed">
          Repair job WO-4471 is done, but Finance can’t bill it yet. First they must prove what work was done, what the quote allows and what the
          customer approved in writing.
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          The evidence sits in four places that disagree. Finance loses time searching and cross-checking by hand, then waiting on people for
          answers.
        </p>
      </div>

      <ul className="grid grid-cols-4 gap-3">
        {docs.map((d) => {
          const c = CARDS[d.id];
          return (
            <li key={d.id}>
              <button
                className="btn flex h-full w-full flex-col items-start rounded-lg border border-line bg-surface p-3 text-left hover:border-muted"
                onClick={() => show(d)}
                title="View the full document"
              >
                <span className="text-[13px] text-muted">{c.system}</span>
                <span className="mt-0.5 font-medium">{d.title}</span>
                <span className="mt-2 text-[13px] leading-snug">{c.holds}</span>
                <span className="mt-auto pt-2 text-[13px] leading-snug" style={{ color: "var(--color-warn)" }}>
                  ⚠ {c.catch}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialog}
        onClose={() => setViewing(null)}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="m-auto w-[640px] max-w-[90vw] rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/60"
      >
        {viewing && (
          <div className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-[13px] text-muted">{CARDS[viewing.id].system}</p>
                <h3 className="font-medium">{viewing.title}</h3>
              </div>
              <button className="btn rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:border-muted" onClick={() => dialog.current?.close()}>
                Close
              </button>
            </div>
            <pre className="mt-4 max-h-[60vh] overflow-auto rounded-lg border border-line bg-bg p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
              {viewing.text}
            </pre>
          </div>
        )}
      </dialog>
    </section>
  );
}
