import { loadCase } from "@/lib/case";
import Walkthrough from "@/components/Walkthrough";

export default function Page() {
  return <Walkthrough data={loadCase()} />;
}
