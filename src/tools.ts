import {
    checkInvoice,
    type ContractRate,
    type WorkOrder,
    type Invoice,
} from "./check-invoice.js";

const contractRate: ContractRate = {
    itemCode: "LAB-TECH",
    unitPriceCents: 9500,
};

const workOrder: WorkOrder = {
    id: "WO-001",
    itemCode: "LAB-TECH",
    hours: 6,
};

const invoice: Invoice = {
    id: "INV-001",
    workOrderId: "WO-001",
    itemCode: "LAB-TECH",
    quantity: 6,
    unitPriceCents: 9500,
};

const incorrectInvoice: Invoice = {
    ...invoice,
    id: "INV-002",
    unitPriceCents: 5900,
};

const invoices: Invoice[] = [invoice, incorrectInvoice];


export function getInvoice(invoiceId: string) {
    const invoice = invoices.find((invoice) => invoice.id === invoiceId);

    if (!invoice) {
        return {
            status: "NOT_FOUND",
            reason: `Invoice ${invoiceId} was not found.`,
        };
    }

    return {
        status: "FOUND",
        invoice,
    };
}

export function reconcileInvoice(invoiceId: string) {
    const invoice = invoices.find((invoice) => invoice.id === invoiceId);

    if (!invoice) {
        return {
            status: "NOT_FOUND",
            reason: `Invoice ${invoiceId} was not found.`,
        };
    }

    return checkInvoice(invoice, workOrder, contractRate);
}