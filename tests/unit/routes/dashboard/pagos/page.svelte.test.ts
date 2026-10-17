import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ComponentProps } from 'svelte';
import PaymentsPage from '../../../../../src/routes/dashboard/pagos/+page.svelte';
import { authData, emptyFilters, payment } from '../../../../helpers/payments';
import { transport } from '../../../../helpers/forms';

vi.mock('$app/navigation', async () => ({ goto: (await import('../../../../helpers/forms')).transport.goto }));
type Data = ComponentProps<typeof PaymentsPage>['data'];
function dataWith(overrides: Partial<Data> = {}): Data {
	return { ...authData, payments: [payment], filters: emptyFilters,
		pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }, ...overrides };
}
function lastUrl() {
	return new URL(String(transport.goto.mock.lastCall?.[0]), 'http://localhost');
}

describe('historial de pagos y tabla', () => {
	it('muestra pago, fecha de México, importe y acceso al registro', async () => {
		const screen = await render(PaymentsPage, { data: dataWith() });
		await expect.element(screen.getByRole('heading', { name: 'Pagos', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: 'Ana Pérez', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: /16 de octubre de 2026/ })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: 'Efectivo', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('link', { name: 'Registrar pago', exact: true })).toHaveAttribute('href', '/dashboard/pagos/registrar');
		await expect.element(screen.getByText('Mostrando 1–1 de 1', { exact: true })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Ir a la página siguiente' })).not.toBeInTheDocument();
	});
	it.each([false, true])('distingue historial vacío con filtros=%s', async (filtered) => {
		const screen = await render(PaymentsPage, { data: dataWith({ payments: [], filters: { ...emptyFilters, q: filtered ? 'nadie' : '' }, pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } }) });
		await expect.element(screen.getByText(filtered ? 'No se encontraron pagos.' : 'No hay pagos registrados.', { exact: true })).toBeVisible();
		await expect.element(screen.getByText(/Mostrando/)).not.toBeInTheDocument();
	});
	it.each([0, 10, 100])('representa pagos sin alumno con descuento %s', async (discountPercent) => {
		const screen = await render(PaymentsPage, { data: dataWith({ payments: [{ ...payment, studentId: null, studentName: 'Sin alumno', purchaseType: 'drop_in_only', discountPercent, totalAmount: discountPercent === 100 ? 0 : 500 - discountPercent * 5 }] }) });
		await expect.element(screen.getByRole('cell', { name: 'Sin alumno', exact: true })).toBeVisible();
		if (discountPercent > 0) await expect.element(screen.getByText(new RegExp(`^-${discountPercent}%`))).toBeVisible();
		else await expect.element(screen.getByText(/^-\d+%/)).not.toBeInTheDocument();
	});
	it('escapa el nombre del alumno', async () => {
		const name = '<img src=x onerror=alert(1)>';
		const screen = await render(PaymentsPage, { data: dataWith({ payments: [{ ...payment, studentName: name }] }) });
		await expect.element(screen.getByRole('cell', { name, exact: true })).toBeVisible();
		expect(screen.container.querySelector('img')).toBeNull();
	});
});

describe('filtros del historial', () => {
	it('precarga búsqueda, tipo, método y fechas desde el servidor', async () => {
		const filters = { q: 'Ana', type: 'combined' as const, method: 'Tarjeta crédito' as const, from: '2026-10-01', to: '2026-10-31' };
		const screen = await render(PaymentsPage, { data: dataWith({ filters }) });
		await expect.element(screen.getByRole('textbox', { name: 'Buscar por nombre de alumno' })).toHaveValue('Ana');
		await expect.element(screen.getByRole('combobox', { name: 'Tipo', exact: true })).toHaveValue('combined');
		await expect.element(screen.getByRole('combobox', { name: 'Método', exact: true })).toHaveValue('Tarjeta crédito');
		await expect.element(screen.getByLabelText('Desde', { exact: true })).toHaveValue('2026-10-01');
		await expect.element(screen.getByLabelText('Hasta', { exact: true })).toHaveValue('2026-10-31');
		expect(transport.goto).not.toHaveBeenCalled();
	});
	it('espera la escritura de búsqueda y conserva filtros reiniciando la página', async () => {
		const screen = await render(PaymentsPage, { data: dataWith({ filters: { ...emptyFilters, type: 'combined' }, pagination: { page: 2, pageSize: 20, total: 30, totalPages: 2 } }) });
		const search = screen.getByRole('textbox', { name: 'Buscar por nombre de alumno' });
		await search.fill('A');
		await search.fill('  Ana & José  ');
		expect(transport.goto).not.toHaveBeenCalled();
		await expect.poll(() => transport.goto.mock.calls.length).toBe(1);
		expect(lastUrl().searchParams.get('q')).toBe('Ana & José');
		expect(lastUrl().searchParams.get('type')).toBe('combined');
		expect(lastUrl().searchParams.has('page')).toBe(false);
	});
	it.each([
		['Tipo', 'combined', 'type'], ['Método', 'Transferencia', 'method']
	])('aplica el filtro %s sin perder los otros', async (label, value, parameter) => {
		const screen = await render(PaymentsPage, { data: dataWith({ filters: { ...emptyFilters, q: 'Ana' } }) });
		await screen.getByRole('combobox', { name: label, exact: true }).selectOptions(value);
		expect(lastUrl().searchParams.get(parameter)).toBe(value);
		expect(lastUrl().searchParams.get('q')).toBe('Ana');
		expect(transport.goto).toHaveBeenLastCalledWith(expect.any(String), { replaceState: true, keepFocus: true, noScroll: true });
	});
	it.each([['Desde', 'from'], ['Hasta', 'to']])('aplica fecha %s', async (label, parameter) => {
		const screen = await render(PaymentsPage, { data: dataWith() });
		await screen.getByLabelText(label, { exact: true }).fill('2026-10-16');
		expect(lastUrl().searchParams.get(parameter)).toBe('2026-10-16');
	});
	it('limpia todos los filtros y los controles', async () => {
		const screen = await render(PaymentsPage, { data: dataWith({ filters: { q: 'Ana', type: 'combined', method: 'Efectivo', from: '2026-10-01', to: '2026-10-31' } }) });
		await screen.getByRole('button', { name: 'Limpiar', exact: true }).click();
		expect(lastUrl().pathname).toBe('/dashboard/pagos');
		expect(lastUrl().search).toBe('');
		await expect.element(screen.getByRole('textbox', { name: 'Buscar por nombre de alumno' })).toHaveValue('');
		await expect.element(screen.getByRole('combobox', { name: 'Tipo', exact: true })).toHaveValue('');
	});
});

describe('controles de paginación', () => {
	it.each([1, 2])('respeta los límites en la página %s y conserva filtros al navegar', async (page) => {
		const screen = await render(PaymentsPage, { data: dataWith({ filters: { ...emptyFilters, q: 'Ana' }, pagination: { page, pageSize: 20, total: 21, totalPages: 2 } }) });
		const previous = screen.getByRole('button', { name: 'Ir a la página anterior' });
		const next = screen.getByRole('button', { name: 'Ir a la página siguiente' });
		await expect.element(page === 1 ? previous : next).toBeDisabled();
		await expect.element(screen.getByText(page === 1 ? 'Mostrando 1–20 de 21' : 'Mostrando 21–21 de 21', { exact: true })).toBeVisible();
		expect(screen.container.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe(String(page));
		await (page === 1 ? next : previous).click();
		expect(lastUrl().searchParams.get('page')).toBe(page === 1 ? '2' : null);
		expect(lastUrl().searchParams.get('q')).toBe('Ana');
	});
});
