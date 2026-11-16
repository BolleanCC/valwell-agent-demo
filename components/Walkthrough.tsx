"use client";

import { useCallback, useEffect, useState } from "react";
import FlowCanvas from "./FlowCanvas";
import StepPanel, { type Session } from "./StepPanel";
import { ActorIcon } from "./ActorIcon";
import BusinessProblem from "./BusinessProblem";
import { nodes, KIND, TOTAL_STEPS } from "@/lib/flow";
import type { CaseData } from "@/lib/case";

const LEGEND = [KIND.rule, KIND.ai, KIND.human].map((k, i) => ({ ...k, name: ["Rule", "AI", "Human"][i] }));

export default function Walkthrough({ data }: { data: CaseData }) {
  const [step, setStep] = useState(1);
  // Furthest step revealed so far: those nodes stay on the canvas, so a click can jump back and forth.
  const [maxStep, setMaxStep] = useState(1);
  // AI results and reviewer decisions from this session; steps 13–15 fall back to recorded data.
  const [session, setSession] = useState<Session>({ decisions: {} });
  const goTo = useCallback((n: number) => {
    const target = Math.min(TOTAL_STEPS, Math.max(1, n));
    setStep(target);
    setMaxStep((m) => Math.max(m, target));
  }, []);
  const next = useCallback(() => goTo(step + 1), [goTo, step]);
  const back = useCallback(() => goTo(step - 1), [goTo, step]);
  const reset = useCallback(() => {
    setStep(1);
    setMaxStep(1);
    setSession({ decisions: {} });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target instanceof Element && e.target.closest("input, textarea")) || document.querySelector("dialog[open]")) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
      else if (e.key === "r" || e.key === "R") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, reset]);

  const current = nodes.find((n) => n.step === step)!;
  const wide = current.ai !== undefined || step >= 13; // AI demos and rule outputs need room

  return (
    <div className="grid h-screen grid-rows-[auto_auto_1fr]">
      <BusinessProblem docs={data.docs} />
      <header className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <h1 className="text-xl font-medium tracking-tight">Invoice readiness for a completed repair job</h1>
          <p className="text-[13px] text-muted">Rules decide, AI reads, humans approve.</p>
        </div>

        <ul className="flex gap-4 text-[13px] font-medium" aria-label="Legend">
          {LEGEND.map((k) => (
            <li key={k.name} className="flex items-center gap-2">
              <ActorIcon actor={k.icon} color={k.color} />
              {k.name}
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-3">
          <div className="w-32">
            <p className="text-[13px] font-medium tabular-nums">
              Step {step} / {TOTAL_STEPS}
            </p>
            <div className="mt-1 h-1 rounded-full bg-line">
              <div className="h-1 rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
            </div>
          </div>
          <button className="btn rounded-lg whitespace-nowrap border border-line px-3 py-2 text-sm font-medium hover:border-muted" onClick={reset} title="Reset (R)">
            Reset
          </button>
          <button className="btn rounded-lg whitespace-nowrap border border-line px-3 py-2 text-sm font-medium hover:border-muted disabled:opacity-40" onClick={back} disabled={step === 1} title="Back (←)">
            ← Back
          </button>
          <button className="btn rounded-lg whitespace-nowrap bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40" onClick={next} disabled={step === TOTAL_STEPS} title="Next (→)">
            Next →
          </button>
        </div>
      </header>

      <div
        className="grid min-h-0"
        style={{ gridTemplateColumns: `minmax(0, 1fr) ${wide ? 820 : 460}px` }}
      >
        <FlowCanvas step={step} maxStep={maxStep} onSelect={goTo} />
        <StepPanel node={current} data={data} session={session} setSession={setSession} />
      </div>
    </div>
  );
}
