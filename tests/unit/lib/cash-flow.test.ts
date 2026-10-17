import { describe, expect, it } from 'vitest';
import {
	resolveCashFlowPeriod, buildCashFlowSummary, buildLifetimeMethodBalances,
	validateAdditionalIncomeInput, validateExpenseInput, toExpenseFormValues,
	toAdditionalIncomeFormValues, serializeCashFlowIncome, formatCashFlowChartAxisLabel,
	type AdditionalIncomeFormValues, type ExpenseFormValues
} from '$lib/cash-flow';
import { period, paymentIncome, additionalIncome, expense, cashFlowNow, validIncome, validExpense } from '../../helpers/cash-flow';

describe('periodos del flujo de efectivo', () => {
	it.each([
		['this_month', '2026-10-01', '2026-10-16'], ['last_month', '2026-09-01', '2026-09-30'],
		['last_3_months', '2026-08-01', '2026-10-16'], ['last_6_months', '2026-05-01', '2026-10-16']
	])('resuelve %s usando el día de México', (preset, from, to) => {
		expect(resolveCashFlowPeriod(new URLSearchParams({ preset }), cashFlowNow)).toMatchObject({ preset, from, to });
	});
	it('cruza el año al calcular meses anteriores', () => {
		expect(resolveCashFlowPeriod(new URLSearchParams({ preset: 'last_3_months' }), new Date('2026-01-15T18:00:00Z'))).toMatchObject({ from: '2025-11-01', to: '2026-01-15' });
	});
	it('incluye el 29 de febrero en un año bisiesto', () => {
		expect(resolveCashFlowPeriod(new URLSearchParams({ preset: 'last_month' }), new Date('2024-03-15T18:00:00Z'))).toMatchObject({ from: '2024-02-01', to: '2024-02-29' });
	});
	it('normaliza fechas invertidas y acepta un solo día', () => {
		expect(resolveCashFlowPeriod(new URLSearchParams({ preset: 'custom', from: '2026-10-31', to: '2026-10-01' }), cashFlowNow)).toMatchObject({ preset: 'custom', from: '2026-10-01', to: '2026-10-31' });
		expect(resolveCashFlowPeriod(new URLSearchParams({ preset: 'custom', from: period.from, to: period.to }), cashFlowNow)).toMatchObject({ from: period.from, to: period.to });
	});
	it.each([
		{}, { preset: 'desconocido' }, { preset: 'custom' },
		{ preset: 'custom', from: '2026-10-01' }, { preset: 'custom', from: 'incorrecta', to: '2026-10-16' }
	])('usa el mes actual ante parámetros incompletos o inválidos (%j)', (params) => {
		expect(resolveCashFlowPeriod(new URLSearchParams(params as Record<string, string>), cashFlowNow)).toMatchObject({ preset: 'this_month', from: '2026-10-01', to: '2026-10-16' });
	});
});

describe('validación de ingresos y egresos', () => {
	for (const kind of ['income', 'expense'] as const) {
		const validate = (data: Partial<ExpenseFormValues> = {}) => kind === 'income'
			? validateAdditionalIncomeInput({ ...validIncome, ...data } as AdditionalIncomeFormValues)
			: validateExpenseInput({ ...validExpense, ...data });
		it(`normaliza monto y descripción del ${kind}`, () => {
			expect(validate().errors).toEqual({});
			expect(validate().parsed).toMatchObject({ amount: 200, description: 'Venta de uniformes', paymentMethod: 'Transferencia', paidAt: new Date('2026-10-16T12:00:00Z') });
		});
		it.each(['', ' ', '0', '-1', '1.5', 'texto', 'Infinity'])(`rechaza monto %j en ${kind}`, (amount) => {
			expect(validate({ amount }).parsed).toBeNull();
			expect(validate({ amount }).errors.amount).toBeDefined();
		});
		it.each(['1', '1000000'])(`acepta monto entero %s en ${kind}`, (amount) => {
			expect(validate({ amount }).parsed?.amount).toBe(Number(amount));
		});
		it.each([{ description: '  ' }, { paidAt: '' }, { paymentMethod: 'Bitcoin' as 'Efectivo' }])(`rechaza campos inválidos de ${kind}: %j`, (invalid) => {
			expect(validate(invalid).parsed).toBeNull();
		});
	}
	it.each(['', 'no-existe'])('rechaza categoría de egreso %j', (category) => {
		expect(validateExpenseInput({ ...validExpense, category: category as ExpenseFormValues['category'] }).errors.category).toBeDefined();
	});
	it('prepara formularios vacíos y fechas en la zona de México', () => {
		expect(toAdditionalIncomeFormValues(null, period.from)).toEqual({ amount: '', description: '', paymentMethod: 'Efectivo', paidAt: period.from });
		expect(toExpenseFormValues(null, period.from)).toMatchObject({ amount: '', category: '', paidAt: period.from });
		expect(toExpenseFormValues({ ...expense, paidAt: cashFlowNow }).paidAt).toBe('2026-10-16');
		expect(toAdditionalIncomeFormValues({ ...additionalIncome, paidAt: cashFlowNow }).paidAt).toBe('2026-10-16');
	});
});

describe('resumen, categorías y movimientos', () => {
	it('conserva puntos en cero para un periodo sin movimientos', () => {
		const summary = buildCashFlowSummary([], [], [], period);
		expect(summary).toMatchObject({ totalIncome: 0, totalExpenses: 0, netCashFlow: 0, incomeCount: 0, expenseCount: 0, categoryBreakdown: [], movements: [] });
		expect(summary.chartDisplayPoints).toHaveLength(1);
	});
	it('suma pagos e ingresos adicionales, resta egresos y distingue IDs coincidentes', () => {
		const summary = buildCashFlowSummary([paymentIncome], [additionalIncome], [expense], period);
		expect(summary).toMatchObject({ totalIncome: 700, totalExpenses: 300, netCashFlow: 400, incomeCount: 2, expenseCount: 1 });
		expect(summary.movements.map((m) => m.id)).toEqual(['expense-1', 'additional-income-1', 'payment-1']);
		expect(summary.chartPoints[0]).toMatchObject({ income: 700, expenses: 300, net: 400 });
	});
	it('representa déficit y distribuye categorías en orden descendente', () => {
		const summary = buildCashFlowSummary([], [], [expense, { ...expense, id: 2, category: 'servicios', amount: 100 }], period);
		expect(summary.netCashFlow).toBe(-400);
		expect(summary.categoryBreakdown).toEqual([
			{ category: 'renta', label: 'Renta', amount: 300, percentage: 75 },
			{ category: 'servicios', label: 'Servicios', amount: 100, percentage: 25 }
		]);
	});
	it('agrupa categorías repetidas sin duplicarlas y evita porcentajes NaN con cero', () => {
		expect(buildCashFlowSummary([], [], [expense, { ...expense, id: 2 }], period).categoryBreakdown).toEqual([{ category: 'renta', label: 'Renta', amount: 600, percentage: 100 }]);
		expect(buildCashFlowSummary([], [], [{ ...expense, amount: 0 }], period).categoryBreakdown[0].percentage).toBe(0);
	});
	it.each([14, 15])('omite días inactivos solo cuando el periodo supera 14 días (%s)', (days) => {
		const selected = { ...period, from: '2026-10-01', to: `2026-10-${days}` };
		const summary = buildCashFlowSummary([{ ...paymentIncome, paidAt: new Date('2026-10-02T18:00:00Z') }], [], [], selected);
		expect(summary.chartPoints).toHaveLength(days);
		expect(summary.chartDisplayPoints).toHaveLength(days === 14 ? 14 : 1);
	});
	it.each([45, 46])('cambia de agrupación diaria a mensual al superar 45 días (%s)', (days) => {
		const summary = buildCashFlowSummary([], [], [], { ...period, from: '2026-01-01', to: days === 45 ? '2026-02-14' : '2026-02-15' });
		expect(summary.chartPoints).toHaveLength(days === 45 ? 45 : 2);
		expect(summary.chartPoints[0].key).toBe(days === 45 ? '2026-01-01' : '2026-01');
	});
	it('asigna movimientos al día y mes de México en los límites UTC', () => {
		const day = buildCashFlowSummary([{ ...paymentIncome, paidAt: cashFlowNow }], [], [], period);
		expect(day.chartPoints[0].income).toBe(500);
		const months = buildCashFlowSummary([{ ...paymentIncome, paidAt: new Date('2026-11-01T01:00:00Z') }], [], [], { ...period, from: '2026-10-01', to: '2026-11-30' });
		expect(months.chartPoints.map((p) => p.income)).toEqual([500, 0]);
	});
	it('mantiene ingresos de pago cero y el nombre para pagos sin alumno', () => {
		const income = serializeCashFlowIncome({ ...paymentIncome, totalAmount: 0 }, null);
		expect(income.studentName).toBe('Sin alumno');
		expect(buildCashFlowSummary([income], [], [], period)).toMatchObject({ incomeCount: 1, totalIncome: 0 });
	});
	it('formatea ejes de meses y días', () => {
		expect(formatCashFlowChartAxisLabel('2026-10')).toBe('oct');
		expect(formatCashFlowChartAxisLabel('2026-10-16')).toContain('16');
	});
});

describe('saldos históricos por método', () => {
	it('maneja filas vacías', () => {
		expect(buildLifetimeMethodBalances([], [], [])).toEqual({ cash: 0, transfer: 0 });
	});
	it('suma fuentes y filas repetidas, resta gastos e ignora otros métodos', () => {
		expect(buildLifetimeMethodBalances(
			[{ paymentMethod: 'Efectivo', total: 500 }, { paymentMethod: 'Efectivo', total: 100 }, { paymentMethod: 'Tarjeta crédito', total: 9999 }],
			[{ paymentMethod: 'Transferencia', total: 200 }],
			[{ paymentMethod: 'Efectivo', total: 300 }, { paymentMethod: 'Transferencia', total: 400 }]
		)).toEqual({ cash: 300, transfer: -200 });
	});
});
