import {
    checkInvoice,
    type ContractRate,
    type WorkOrder,
    type Invoice,
} from "./check-invoice.js";

// Contract: technician labour costs $95 per hour.
const contractRate: ContractRate = {
    itemCode: "LAB-TECH",
    unitPriceCents: 9500,
};

// Work order: the technician completed 6 hours.
const workOrder: WorkOrder = {
    id: "WO-001",
    itemCode: "LAB-TECH",
    hours: 6,
};

// Normal invoice: 6 hours at $95 per hour.
const invoice: Invoice = {
    id: "INV-001",
    workOrderId: "WO-001",
    itemCode: "LAB-TECH",
    quantity: 6,
    unitPriceCents: 9500,
};

// Incorrect invoice: the hourly rate was entered as $59.
const incorrectInvoice: Invoice = {
    ...invoice,
    id: "INV-002",
    unitPriceCents: 5900,
};

// Our temporary in-memory invoice store.
const invoices: Invoice[] = [invoice, incorrectInvoice];

function getInvoice(invoiceId: string): Invoice | undefined {
    return invoices.find((invoice) => invoice.id === invoiceId);
}

// Check both invoices using the same business function.
const normalResult = checkInvoice(
    invoice,
    workOrder,
    contractRate,
);

console.log("Normal invoice:", normalResult);

const incorrectResult = checkInvoice(
    incorrectInvoice,
    workOrder,
    contractRate,
);

console.log("Incorrect invoice:", incorrectResult);

// Look up invoices by ID.
console.log("Found invoice:", getInvoice("INV-001"));
console.log("Missing invoice:", getInvoice("INV-999"));