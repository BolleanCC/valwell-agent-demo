import { getInvoice, reconcileInvoice } from "./tools.js";

// Simulate a tool call requested by the model.
const toolCall = {
    name: "delete_invoice",
    arguments: {
        invoiceId: "INV-001",
    },
};

function executeTool(name: string, invoiceId: string) {
    switch (name) {
        case "get_invoice":
            return getInvoice(invoiceId);

        case "reconcile_invoice":
            return reconcileInvoice(invoiceId);

        default:
            return {
                status: "UNKNOWN_TOOL",
                reason: `Tool ${name} is not supported.`,
            };
    }
}

const result = executeTool(
    toolCall.name,
    toolCall.arguments.invoiceId,
);

console.log("Tool call:", toolCall);
console.log("Tool result:", result);