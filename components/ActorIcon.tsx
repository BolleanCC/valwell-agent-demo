import { KIND } from "@/lib/flow";

export type Actor = "rule" | "ai" | "human";

// Line icons from Lucide (ISC licence, lucide.dev): settings, bot, user.
const PATHS: Record<Actor, React.ReactNode> = {
  rule: (
    <>
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0a2.34 2.34 0 0 0 3.319 1.915a2.34 2.34 0 0 1 2.33 4.033a2.34 2.34 0 0 0 0 3.831a2.34 2.34 0 0 1-2.33 4.033a2.34 2.34 0 0 0-3.319 1.915a2.34 2.34 0 0 1-4.659 0a2.34 2.34 0 0 0-3.32-1.915a2.34 2.34 0 0 1-2.33-4.033a2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  ai: (
    <>
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2m16 0h2m-7-1v2m-6-2v2" />
    </>
  ),
  human: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
};

// Sized to the surrounding text; colour follows `color` (or currentColor).
export function ActorIcon({ actor, color }: { actor: Actor; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.05em"
      height="1.05em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="inline-block shrink-0 align-[-0.15em]"
      style={color ? { color } : undefined}
    >
      {PATHS[actor]}
    </svg>
  );
}

// Node labels in lib/flow.ts mark who does each part with ⚙️ / 🤖 / 👤; render those markers as icons.
const MARKS: Record<string, Actor> = { "⚙️": "rule", "🤖": "ai", "👤": "human" };

export function LabelLine({ line }: { line: string }) {
  const m = line.match(/^(⚙️|🤖|👤)\s*/u);
  if (!m) return <>{line}</>;
  const actor = MARKS[m[1]];
  return (
    <>
      <ActorIcon actor={actor} color={KIND[actor].color} /> {line.slice(m[0].length)}
    </>
  );
}
