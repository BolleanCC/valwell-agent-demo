import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Source = "live" | "recorded";
export type ToolResult<T> = { data: T; source: Source; note?: string };

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ maxRetries: 1, timeout: 60_000 }) : null;

function recorded<T>(step: string, note: string): ToolResult<T> {
  const file = join(process.cwd(), "data/case-001/recorded", `${step}.json`);
  return { data: JSON.parse(readFileSync(file, "utf8")), source: "recorded", note };
}

// One structured call. The tool is strict, so its input always matches the schema.
// Current models reject forced tool_choice and custom temperature, so the prompt names the tool.
// Any failure (no key, network, refusal, no tool call) returns the recorded response instead.
export async function callTool<T>(step: string, system: string, user: string, tool: Anthropic.Tool): Promise<ToolResult<T>> {
  if (!client) return recorded(step, "No ANTHROPIC_API_KEY set, showing the recorded response.");
  try {
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 8000,
      system,
      tools: [{ ...tool, strict: true }],
      tool_choice: { type: "auto", disable_parallel_tool_use: true },
      messages: [{ role: "user", content: user }],
    });
    const call = res.content.find((b) => b.type === "tool_use" && b.name === tool.name);
    if (!call || call.type !== "tool_use") {
      return recorded(step, `The model did not call ${tool.name} (stop reason: ${res.stop_reason}), showing the recorded response.`);
    }
    return { data: call.input as T, source: "live" };
  } catch (e) {
    return recorded(step, `API call failed (${e instanceof Error ? e.message : String(e)}), showing the recorded response.`);
  }
}

export const doc = (id: string, text: string) => `<document id="${id}">\n${text}\n</document>`;
