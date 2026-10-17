import { describe, expect, it } from 'vitest';
import {
	parsePaymentListFilters, parsePaymentListPage, resolvePaymentListDateRange,
	buildPaymentListSearchParams, paymentListHasActiveFilters, parseDiscountPercent,
	calculatePaymentTotals, calculateWizardTotal, validatePaymentWizard,
	formatPaymentDate, formatStudentName, type PaymentWizardData
} from '$lib/payments';
import { emptyFilters, wizardValues, wizardProps } from '../../helpers/payments';

const invalidFilterCases: Record<string, string>[] = [
	{ type: 'otro' }, { method: 'bitcoin' }, { from: '16/10/2026' }, { to: 'no-fecha' }
];

describe('filtros y paginación del historial de pagos', () => {
	it('interpreta parámetros ausentes como filtros vacíos y página uno', () => {
		expect(parsePaymentListFilters(new URLSearchParams())).toEqual(emptyFilters);
		expect(parsePaymentListPage(new URLSearchParams())).toBe(1);
	});
	it('conserva filtros válidos, recorta búsqueda y ordena fechas invertidas', () => {
		expect(parsePaymentListFilters(new URLSearchParams({ q: '  María & José  ', type: 'combined', method: 'Tarjeta crédito', from: '2026-10-31', to: '2026-10-01' }))).toEqual({ q: 'María & José', type: 'combined', method: 'Tarjeta crédito', from: '2026-10-01', to: '2026-10-31' });
	});
	it.each(invalidFilterCases)('descarta parámetros inválidos %j', (invalid) => {
		expect(parsePaymentListFilters(new URLSearchParams(invalid))).toEqual(emptyFilters);
	});
	it.each(['', '0', '-1', '1.5', 'texto', 'Infinity'])('usa página uno ante %j', (page) => {
		expect(parsePaymentListPage(new URLSearchParams({ page }))).toBe(1);
	});
	it.each([1, 2, 1000])('acepta la página entera %s', (page) => {
		expect(parsePaymentListPage(new URLSearchParams({ page: String(page) }))).toBe(page);
	});
	it.each(['from', 'to'] as const)('interpreta una sola fecha en %s como un día completo', (field) => {
		expect(resolvePaymentListDateRange({ ...emptyFilters, [field]: '2026-10-16' })).toEqual({ from: '2026-10-16', to: '2026-10-16' });
	});
	it('resuelve rango abierto sin fechas y rango inclusivo con ambas', () => {
		expect(resolvePaymentListDateRange(emptyFilters)).toEqual({ from: '', to: '' });
		expect(resolvePaymentListDateRange({ ...emptyFilters, from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-10-01', to: '2026-10-31' });
	});
	it('serializa caracteres especiales sin perder datos y omite la primera página', () => {
		const filters = { ...emptyFilters, q: 'Ána & 50%_\\', type: 'drop_in_only' as const, method: 'Tarjeta débito' as const };
		const params = buildPaymentListSearchParams(filters, 2);
		expect(parsePaymentListFilters(new URLSearchParams(params.toString()))).toEqual(filters);
		expect(params.get('page')).toBe('2');
		expect(buildPaymentListSearchParams(emptyFilters, 1).size).toBe(0);
	});
	it.each(['q', 'type', 'method', 'from', 'to'] as const)('detecta el filtro activo %s', (field) => {
		expect(paymentListHasActiveFilters({ ...emptyFilters, [field]: 'valor' })).toBe(true);
		expect(paymentListHasActiveFilters(emptyFilters)).toBe(false);
	});
});

describe('validación y cálculo de pagos', () => {
	it.each(['', '  ', '0', '100', ' 10 '])('acepta descuento %j', (discount) => {
		expect(parseDiscountPercent(discount)).toBe(Number(discount));
	});
	it.each(['-1', '101', '0.5', 'texto', 'Infinity'])('rechaza descuento %j', (discount) => {
		expect(parseDiscountPercent(discount)).toBeNaN();
	});
	it.each([[500, 0, 0, 500], [500, 100, 500, 0], [101, 50, 51, 50], [0, 10, 0, 0]])('calcula subtotal %s con descuento %s', (subtotalAmount, discountPercent, discountAmount, totalAmount) => {
		expect(calculatePaymentTotals(subtotalAmount, discountPercent)).toEqual({ subtotalAmount, discountPercent, discountAmount, totalAmount });
	});
	it.each([['monthly_only', 500], ['full_pass_only', 700], ['combined', 1200], ['drop_in_only', 100]] as const)('suma los planes de %s', (type, total) => {
		expect(calculateWizardTotal(type, wizardProps.plans, 1, 2, 3)).toBe(total);
	});
	it('acepta clase suelta sin alumno y exige alumno en los otros tipos', () => {
		const dropIn = { ...wizardValues, studentId: '', purchaseType: 'drop_in_only' as const, dropInPlanId: '3' };
		expect(validatePaymentWizard(dropIn, wizardProps.plans, wizardProps.courses).errors).toEqual({});
		expect(validatePaymentWizard({ ...wizardValues, studentId: '' }, wizardProps.plans, wizardProps.courses).errors.studentId).toBeDefined();
	});
	it.each([
		{ courseId: '99' }, { monthlyPlanId: '2' }, { monthlyPlanId: '99' },
		{ paymentMethod: 'Inválido' }, { paidAt: '' }, { discountPercent: '-1' }, { purchaseType: 'desconocido' }
	])('rechaza entradas inválidas %j', (invalid) => {
		const result = validatePaymentWizard({ ...wizardValues, ...invalid } as PaymentWizardData, wizardProps.plans, wizardProps.courses);
		expect(Object.keys(result.errors)).not.toHaveLength(0);
	});
	it('muestra fecha en México aunque UTC ya sea el día siguiente', () => {
		expect(formatPaymentDate('2026-10-17T01:00:00Z')).toContain('16 de octubre de 2026');
	});
	it.each([null, undefined, ''])('identifica pagos sin alumno (%j)', (name) => {
		expect(formatStudentName(name)).toBe('Sin alumno');
	});
});
