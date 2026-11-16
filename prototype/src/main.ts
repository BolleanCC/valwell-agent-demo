import { getInvoice, reconcileInvoice } from "./tools.js";
import { executeTool } from "./tools.js";

// Simulate a tool call requested by the model.
const toolCall = {
    name: "delete_invoice",
    arguments: {
        invoiceId: "INV-001",
    },
};


const result = executeTool(
    toolCall.name,
    toolCall.arguments.invoiceId,
);

console.log("Tool call:", toolCall);
console.log("Tool result:", result);