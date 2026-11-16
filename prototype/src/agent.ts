import { loadEnvFile } from "node:process";
import Anthropic from "@anthropic-ai/sdk";
import { executeTool } from "./tools.js";

loadEnvFile(".env");

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.LLM_MODEL;

if (!apiKey || !model) {
    throw new Error(
        "Set ANTHROPIC_API_KEY and LLM_MODEL in .env.",
    );
}

const client = new Anthropic({
    apiKey,
    maxRetries: 0,
    timeout: 30_000,
});

// Instructions shared by both requests.
const systemPrompt = [
    "You assist with invoice reconciliation.",
    "Use tools to obtain invoice facts.",
    "Do not invent records or calculate financial amounts.",
    "Inspect the invoice before requesting reconciliation.",
    "You cannot modify or approve invoices.",
    "If a tool fails, explain the problem honestly.",
].join("\n");

// Tool descriptions tell the model what it can request.
// The actual functions are implemented in tools.ts.
const tools: Anthropic.Messages.Tool[] = [
    {
        name: "get_invoice",
        description: "Retrieve an invoice by its ID.",
        input_schema: {
            type: "object",
            properties: {
                invoiceId: {
                    type: "string",
                    description: "The invoice ID to retrieve.",
                },
            },
            required: ["invoiceId"],
            additionalProperties: false,
        },
    },
    {
        name: "reconcile_invoice",
        description:
            "Check an invoice against its work order and contract. " +
            "Returns authoritative amounts and discrepancies.",
        input_schema: {
            type: "object",
            properties: {
                invoiceId: {
                    type: "string",
                    description: "The invoice ID to check.",
                },
            },
            required: ["invoiceId"],
            additionalProperties: false,
        },
    },
];


const messages: Anthropic.Messages.MessageParam[] = [
    {
        role: "user",
        content: "Please inspect and reconcile invoice INV-001.",
    },
];

const maxTurns = 4;
const maxToolCalls = 8;

let toolCallCount = 0;
let finished = false;

for (let turn = 0; turn < maxTurns; turn++) {
    const response = await client.messages.create({
        model,
        max_tokens: 500,
        system: systemPrompt,
        tools,
        messages,
    });

    // Display the model's explanation.
    for (const block of response.content) {
        if (block.type === "text") {
            console.log(block.text);
        }
    }

    if (response.stop_reason === "end_turn") {
        finished = true;
        break;
    }

    if (response.stop_reason !== "tool_use") {
        throw new Error(
            `Model stopped unexpectedly: ${response.stop_reason}`,
        );
    }

    const calls = response.content.filter(
        (block) => block.type === "tool_use",
    );

    if (calls.length === 0) {
        throw new Error("No tool requests were returned.");
    }

    if (toolCallCount + calls.length > maxToolCalls) {
        throw new Error("Tool-call limit reached.");
    }

    messages.push({
        role: "assistant",
        content: response.content,
    });

    const results: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const call of calls) {
        toolCallCount++;

        try {
            const input = call.input;

            if (
                typeof input !== "object" ||
                input === null ||
                Array.isArray(input) ||
                !("invoiceId" in input) ||
                typeof input.invoiceId !== "string" ||
                input.invoiceId.trim() === "" ||
                Object.keys(input).length !== 1
            ) {
                throw new Error("Expected only a non-empty invoiceId.");
            }

            const result = executeTool(call.name, input.invoiceId);

            console.log(call.name, input, result);

            results.push({
                type: "tool_result",
                tool_use_id: call.id,
                content: JSON.stringify(result),
                is_error:
                    result.status === "NOT_FOUND" ||
                    result.status === "UNKNOWN_TOOL",
            });
        } catch (error) {
            results.push({
                type: "tool_result",
                tool_use_id: call.id,
                content: error instanceof Error ? error.message : String(error),
                is_error: true,
            });
        }
    }

    messages.push({
        role: "user",
        content: results,
    });
}

if (!finished) {
    throw new Error("Model-turn limit reached; the task is incomplete.");
}