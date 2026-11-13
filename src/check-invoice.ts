export type ContractRate = {
    itemCode: string;
    unitPriceCents: number;
};

export type WorkOrder = {
    id: string;
    itemCode: string;
    hours: number;
};

export type Invoice = {
    id: string;
    workOrderId: string;
    itemCode: string;
    quantity: number;
    unitPriceCents: number;
};

// Check the invoice
export function checkInvoice(invoice: Invoice, workOrder: WorkOrder, contractRate: ContractRate) {
    // Check if the invoice references a different work order
    if (invoice.workOrderId !== workOrder.id) {
        return {
            status: "NEEDS_REVIEW",
            reason: "The invoice references a different work."
        }
    }
    // Check if the invoice references a different item code
    if (
        invoice.itemCode !== workOrder.itemCode ||
        invoice.itemCode !== contractRate.itemCode
    ) {
        return {
            status: "NEEDS_REVIEW",
            reason: "The service item codes do not match.",
        };
    }
    // Check if the billed quantity differs from the recorded hours
    if (invoice.quantity !== workOrder.hours) {
        return {
            status: "NEEDS_REVIEW",
            reason: "The billed quantity differs from the recorded hours.",
        };
    }

    const billedAmountCents =
        invoice.quantity * invoice.unitPriceCents;

    const expectedAmountCents =
        workOrder.hours * contractRate.unitPriceCents;

    const differenceCents =
        expectedAmountCents - billedAmountCents;

    return {
        status: differenceCents === 0 ? "MATCHED" : "PRICE_MISMATCH",
        billedAmountCents,
        expectedAmountCents,
        differenceCents,
    };
}
