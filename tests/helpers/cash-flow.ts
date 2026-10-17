import { buildCashFlowSummary, type CashFlowPeriod, type CashFlowExpenseRow, type CashFlowIncomeRow, type CashFlowAdditionalIncomeRow } from '$lib/cash-flow';

export const cashFlowNow = new Date('2026-10-17T01:00:00Z');
export const period: CashFlowPeriod = { preset: 'custom', from: '2026-10-16', to: '2026-10-16', label: '16 oct 2026' };
export const paymentIncome: CashFlowIncomeRow = {
	id: 1, studentName: 'Ana Pérez', purchaseType: 'monthly_only', totalAmount: 500,
	paymentMethod: 'Efectivo', paidAt: new Date('2026-10-16T18:00:00Z')
};
export const additionalIncome: CashFlowAdditionalIncomeRow = {
	id: 1, amount: 200, description: 'Venta de uniformes', paymentMethod: 'Transferencia',
	paidAt: new Date('2026-10-16T19:00:00Z')
};
export const expense: CashFlowExpenseRow = {
	id: 1, amount: 300, category: 'renta', description: 'Renta del estudio',
	paymentMethod: 'Efectivo', paidAt: new Date('2026-10-16T20:00:00Z')
};
export const validIncome = { amount: ' 200 ', description: ' Venta de uniformes ', paymentMethod: 'Transferencia' as const, paidAt: '2026-10-16' };
export const validExpense = { ...validIncome, category: 'renta' as const };
export const emptySummary = () => buildCashFlowSummary([], [], [], period);
export const populatedSummary = () => buildCashFlowSummary([paymentIncome], [additionalIncome], [expense], period);
