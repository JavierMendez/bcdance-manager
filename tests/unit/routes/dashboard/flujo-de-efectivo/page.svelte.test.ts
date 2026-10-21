import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ComponentProps } from 'svelte';
import CashFlowPage from '../../../../../src/routes/dashboard/flujo-de-efectivo/+page.svelte';
import { PAYMENT_METHODS } from '$lib/payments';
import { buildCashFlowSummary } from '$lib/cash-flow';
import { period, emptySummary, populatedSummary, expense, paymentIncome, validExpense, validIncome } from '../../../../helpers/cash-flow';
import { authData } from '../../../../helpers/payments';
import { transport } from '../../../../helpers/forms';

vi.mock('$app/forms', () => import('../../../../helpers/forms'));
vi.mock('$app/navigation', async () => ({ goto: (await import('../../../../helpers/forms')).transport.goto }));
type Data = ComponentProps<typeof CashFlowPage>['data'];
function dataWith(overrides: Partial<Data> = {}): Data {
	return { ...authData, period, summary: emptySummary(), lifetimeBalances: { cash: 0, transfer: 0 }, paymentMethods: PAYMENT_METHODS, ...overrides };
}
let originalUrl: string;
beforeEach(() => { originalUrl = window.location.href; });
afterEach(() => { history.replaceState({}, '', originalUrl); });

describe('resumen, gráfica, categorías y tabla', () => {
	it('busca por los seis campos, muestra cero coincidencias y restaura la tabla al limpiar', async () => {
		const summary = populatedSummary();
		const screen = await render(CashFlowPage, { data: dataWith({ summary }), form: null });
		const search = screen.getByRole('textbox', { name: 'Buscar por fecha, tipo, concepto, detalle, método o monto', exact: true });
		for (const query of [summary.movements[0].paidAtLabel, ' EGRESO ', 'RENTA DEL ESTUDIO', summary.movements[0].detail, 'efectivo', '−$300', '300']) {
			await search.fill(query);
			await expect.element(screen.getByRole('cell', { name: 'Renta del estudio', exact: true })).toBeVisible();
			await expect.element(screen.getByRole('cell', { name: 'Venta de uniformes', exact: true })).not.toBeInTheDocument();
		}
		await search.fill('sin coincidencias');
		await expect.element(screen.getByRole('cell', { name: 'No se encontraron movimientos.', exact: true })).toBeVisible();
		await expect.element(screen.getByText('1 egreso registrado', { exact: true })).toBeVisible();
		await search.fill('');
		for (const name of ['Ana Pérez', 'Venta de uniformes', 'Renta del estudio']) {
			await expect.element(screen.getByRole('cell', { name, exact: true })).toBeVisible();
		}
	});
	it('muestra estados vacíos de gráfica, categorías y movimientos', async () => {
		const screen = await render(CashFlowPage, { data: dataWith(), form: null });
		await expect.element(screen.getByRole('heading', { name: 'Flujo de efectivo', exact: true })).toBeVisible();
		await expect.element(screen.getByText('No hay movimientos en este periodo para graficar.', { exact: true })).toBeVisible();
		await expect.element(screen.getByText('Sin egresos en este periodo.', { exact: true })).toBeVisible();
		await expect.element(screen.getByText(/No hay movimientos en este periodo. Registra pagos/)).toBeVisible();
		expect(screen.container.querySelector('[data-slot="chart"]')).toBeNull();
	});
	it('renderiza la gráfica real, categorías y las tres fuentes con sus signos', async () => {
		const screen = await render(CashFlowPage, { data: dataWith({ summary: populatedSummary() }), form: null });
		await expect.poll(() => Boolean(screen.container.querySelector('[data-slot="chart"] svg'))).toBe(true);
		for (const name of ['Ana Pérez', 'Venta de uniformes', 'Renta del estudio']) {
			await expect.element(screen.getByRole('cell', { name, exact: true })).toBeVisible();
		}
		await expect.element(screen.getByText('100% del total de egresos', { exact: true })).toBeVisible();
		const rows = screen.getByRole('row').elements().slice(1);
		expect(rows.map((row) => row.querySelectorAll('td')[5]?.textContent?.trim().charAt(0))).toEqual(['−', '+', '+']);
	});
	it.each([0, 1, 2])('pluraliza contadores con %s movimientos', async (count) => {
		const incomes = Array.from({ length: count }, (_, id) => ({ ...paymentIncome, id }));
		const expenses = Array.from({ length: count }, (_, id) => ({ ...expense, id }));
		const screen = await render(CashFlowPage, { data: dataWith({ summary: buildCashFlowSummary(incomes, [], expenses, period) }), form: null });
		await expect.element(screen.getByText(`${count} ingreso${count === 1 ? '' : 's'} registrado${count === 1 ? '' : 's'}`, { exact: true })).toBeVisible();
		await expect.element(screen.getByText(`${count} egreso${count === 1 ? '' : 's'} registrado${count === 1 ? '' : 's'}`, { exact: true })).toBeVisible();
	});
	it.each([false, true])('representa déficit=%s y saldos acumulados independientes', async (deficit) => {
		const summary = buildCashFlowSummary(deficit ? [] : [paymentIncome], [], [expense], period);
		const screen = await render(CashFlowPage, { data: dataWith({ summary, lifetimeBalances: { cash: -1500, transfer: 9000 } }), form: null });
		await expect.element(screen.getByText(deficit ? 'Déficit en el periodo' : 'Superávit en el periodo', { exact: true })).toBeVisible();
		const cards = Array.from(screen.container.querySelectorAll('[data-slot="card"]'));
		const cashCard = cards.find((card) => card.textContent?.includes('Saldo en efectivo'));
		const transferCard = cards.find((card) => card.textContent?.includes('Saldo en transferencias'));
		expect(cashCard?.textContent).toContain('-$1,500');
		expect(transferCard?.textContent).toContain('$9,000');
	});
	it('escapa el concepto de los movimientos', async () => {
		const description = '<img src=x onerror=alert(1)>';
		const screen = await render(CashFlowPage, { data: dataWith({ summary: buildCashFlowSummary([], [], [{ ...expense, description }], period) }), form: null });
		await expect.element(screen.getByRole('cell', { name: description, exact: true })).toBeVisible();
		expect(screen.container.querySelector('img')).toBeNull();
	});
});

describe('selección de periodos', () => {
	it.each(['this_month', 'last_month', 'last_3_months', 'last_6_months'])('aplica %s y bloquea las fechas manuales', async (preset) => {
		const screen = await render(CashFlowPage, { data: dataWith(), form: null });
		await screen.getByRole('combobox', { name: 'Vista rápida', exact: true }).selectOptions(preset);
		await expect.element(screen.getByLabelText('Desde', { exact: true })).toBeDisabled();
		await expect.element(screen.getByLabelText('Hasta', { exact: true })).toBeDisabled();
		await screen.getByRole('button', { name: 'Aplicar periodo', exact: true }).click();
		expect(transport.goto).toHaveBeenCalledExactlyOnceWith(`/dashboard/flujo-de-efectivo?preset=${preset}`);
	});
	it('aplica rango personalizado con sus dos fechas', async () => {
		const screen = await render(CashFlowPage, { data: dataWith(), form: null });
		await screen.getByLabelText('Desde', { exact: true }).fill('2026-10-01');
		await screen.getByLabelText('Hasta', { exact: true }).fill('2026-10-31');
		await screen.getByRole('button', { name: 'Aplicar periodo', exact: true }).click();
		expect(transport.goto).toHaveBeenCalledExactlyOnceWith('/dashboard/flujo-de-efectivo?preset=custom&from=2026-10-01&to=2026-10-31');
	});
	it.each(['Desde', 'Hasta'])('no navega si falta la fecha %s del rango personalizado', async (label) => {
		const screen = await render(CashFlowPage, { data: dataWith(), form: null });
		await screen.getByLabelText(label, { exact: true }).fill('');
		await screen.getByRole('button', { name: 'Aplicar periodo', exact: true }).click();
		expect(transport.goto).not.toHaveBeenCalled();
	});
});

describe('avisos, altas y eliminación confirmada', () => {
	it.each([
		['saved', 'El egreso se registró correctamente.'], ['deleted', 'El egreso se eliminó correctamente.'],
		['incomeSaved', 'El ingreso adicional se registró correctamente.'], ['incomeDeleted', 'El ingreso adicional se eliminó correctamente.']
	])('muestra aviso %s y limpia solo ese parámetro de URL', async (flag, message) => {
		const url = new URL(window.location.href); url.searchParams.set(flag, '1'); url.searchParams.set('preset', 'custom');
		history.replaceState({}, '', url);
		const screen = await render(CashFlowPage, { data: dataWith(), form: null });
		await expect.element(screen.getByText(message, { exact: true })).toBeVisible();
		expect(new URL(window.location.href).searchParams.has(flag)).toBe(false);
		expect(new URL(window.location.href).searchParams.get('preset')).toBe('custom');
	});
	it.each(['Registrar egreso', 'Registrar ingreso adicional'])('abre el diálogo %s desde la página', async (name) => {
		const screen = await render(CashFlowPage, { data: dataWith(), form: null });
		await screen.getByRole('button', { name, exact: true }).click();
		await expect.element(screen.getByRole('dialog', { name, exact: true })).toBeVisible();
	});
	it.each(['createExpense', 'createAdditionalIncome'] as const)('abre el diálogo y sus errores tras fallar %s', async (mode) => {
		const form = mode === 'createExpense'
			? { mode, errors: { amount: 'Monto inválido' }, values: { ...validExpense, amount: '0' } }
			: { mode, errors: { amount: 'Monto inválido' }, values: { ...validIncome, amount: '0' } };
		const screen = await render(CashFlowPage, { data: dataWith(), form });
		await expect.element(screen.getByRole('dialog')).toBeVisible();
		await expect.element(screen.getByText('Monto inválido', { exact: true })).toBeVisible();
	});
	it.each([
		['Eliminar egreso', '?/deleteExpense', 'expenseId'], ['Eliminar ingreso adicional', '?/deleteAdditionalIncome', 'additionalIncomeId']
	])('cancela y confirma %s, enviando solo el identificador correspondiente', async (name, action, field) => {
		const screen = await render(CashFlowPage, { data: dataWith({ summary: populatedSummary() }), form: null });
		await screen.getByRole('button', { name, exact: true }).click();
		await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
		expect(transport.post).not.toHaveBeenCalled();
		await screen.getByRole('button', { name, exact: true }).click();
		await screen.getByRole('button', { name: 'Eliminar', exact: true }).click();
		await expect.poll(() => transport.post.mock.calls.length).toBe(1);
		const [body, submittedAction] = transport.post.mock.calls[0];
		expect(submittedAction).toBe(action);
		expect(Object.fromEntries(body)).toEqual({ [field]: '1' });
		expect(transport.update).toHaveBeenCalledWith({ invalidateAll: true });
	});
	it('no permite eliminar ingresos que provienen del módulo de pagos', async () => {
		const screen = await render(CashFlowPage, { data: dataWith({ summary: buildCashFlowSummary([paymentIncome], [], [], period) }), form: { message: 'No se pudo eliminar.' } });
		await expect.element(screen.getByRole('button', { name: /Eliminar/ })).not.toBeInTheDocument();
		await expect.element(screen.getByText('No se pudo eliminar.', { exact: true })).toBeVisible();
	});
});
