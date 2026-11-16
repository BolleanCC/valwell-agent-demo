import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Doc, Extraction, WorkOrder } from "./checks";

const dir = join(process.cwd(), "data/case-001");
const read = (f: string) => readFileSync(join(dir, f), "utf8");

export function loadCase() {
  const workOrders: WorkOrder[] = JSON.parse(read("work-orders.json"));
  const workOrder = workOrders.find((w) => w.id === "WO-4471")!;
  const docs: Doc[] = [
    { id: "work-order", title: "Work order WO-4471", text: JSON.stringify(workOrder, null, 2) },
    { id: "service-report", title: "Service report (PDF text)", text: read("service-report-WO-4471.txt") },
    { id: "email", title: "Customer email", text: read("email-thread.txt") },
    { id: "quote", title: "Quote Q-2210", text: read("quote-Q-2210.txt") },
  ];
  // Used for steps 13–15 when AI #2 was not run in this session.
  const recordedEvidence: Extraction = JSON.parse(read("recorded/extract-evidence.json"));
  return { workOrders, workOrder, docs, recordedEvidence };
}

export type CaseData = ReturnType<typeof loadCase>;
