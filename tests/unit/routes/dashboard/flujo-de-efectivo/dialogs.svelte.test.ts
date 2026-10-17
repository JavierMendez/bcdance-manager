import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ActionResult } from '@sveltejs/kit';
import ExpenseDialog from '$lib/components/cash-flow/expense-dialog.svelte';
import AdditionalIncomeDialog from '$lib/components/cash-flow/additional-income-dialog.svelte';
import { PAYMENT_METHODS } from '$lib/payments';
import type { ExpenseFormValues } from '$lib/cash-flow';
import { transport } from '../../../../helpers/forms';

vi.mock('$app/forms', () => import('../../../../helpers/forms'));
type Screen = Awaited<ReturnType<typeof render>>;

for (const kind of ['expense', 'income'] as const) {
	const submitLabel = kind === 'expense' ? 'Registrar egreso' : 'Registrar ingreso';
	const dateLabel = kind === 'expense' ? 'Fecha del egreso' : 'Fecha del ingreso';
	function renderForm(props: { errors?: Record<string, string>; message?: string; onClosed?: () => void; values?: ExpenseFormValues } = {}) {
		return kind === 'expense'
			? render(ExpenseDialog, { open: true, paymentMethods: PAYMENT_METHODS, ...props })
			: render(AdditionalIncomeDialog, { open: true, paymentMethods: PAYMENT_METHODS, ...props });
	}
	async function fillForm(screen: Screen) {
		await screen.getByRole('spinbutton', { name: 'Monto (MXN)', exact: true }).fill('200');
		await screen.getByRole('textbox', { name: 'Descripción', exact: true }).fill('Movimiento de prueba');
		await screen.getByLabelText(dateLabel, { exact: true }).fill('2026-10-16');
		if (kind === 'expense') await screen.getByRole('combobox', { name: 'Categoría', exact: true }).selectOptions('renta');
	}
	describe(`diálogo de ${kind === 'expense' ? 'egreso' : 'ingreso adicional'}`, () => {
		it('muestra campos requeridos y cancela sin enviar', async () => {
			const onClosed = vi.fn();
			const screen = await renderForm({ onClosed });
			await expect.element(screen.getByRole('spinbutton', { name: 'Monto (MXN)', exact: true })).toBeRequired();
			await expect.element(screen.getByRole('textbox', { name: 'Descripción', exact: true })).toBeRequired();
			await expect.element(screen.getByRole('combobox', { name: 'Método de pago', exact: true })).toHaveValue('Efectivo');
			await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
			await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
			expect(onClosed).toHaveBeenCalledOnce();
			expect(transport.post).not.toHaveBeenCalled();
		});
		it.each(['', '0', '-1', '0.5'])('impide enviar monto inválido %j mediante HTML', async (amount) => {
			const screen = await renderForm();
			await fillForm(screen);
			await screen.getByRole('spinbutton', { name: 'Monto (MXN)', exact: true }).fill(amount);
			await screen.getByRole('button', { name: submitLabel, exact: true }).click();
			expect(transport.post).not.toHaveBeenCalled();
		});
		it.each(['description', 'date'])('impide enviar sin %s', async (field) => {
			const screen = await renderForm();
			await fillForm(screen);
			if (field === 'description') await screen.getByRole('textbox', { name: 'Descripción', exact: true }).fill('');
			else await screen.getByLabelText(dateLabel, { exact: true }).fill('');
			await screen.getByRole('button', { name: submitLabel, exact: true }).click();
			expect(transport.post).not.toHaveBeenCalled();
		});
		it('envía los campos correctos y cierra tras la redirección', async () => {
			transport.post.mockResolvedValue({ type: 'redirect', status: 303, location: '/dashboard/flujo-de-efectivo?saved=1' });
			const screen = await renderForm();
			await fillForm(screen);
			await screen.getByRole('combobox', { name: 'Método de pago', exact: true }).selectOptions('Transferencia');
			await screen.getByRole('button', { name: submitLabel, exact: true }).click();
			await expect.poll(() => transport.update.mock.calls.length).toBe(1);
			const [body, action] = transport.post.mock.calls[0];
			expect(action).toBe(kind === 'expense' ? '?/createExpense' : '?/createAdditionalIncome');
			expect(Object.fromEntries(body)).toMatchObject({ amount: '200', description: 'Movimiento de prueba', paymentMethod: 'Transferencia', paidAt: '2026-10-16' });
			if (kind === 'expense') expect(body.get('category')).toBe('renta');
			await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
			expect(transport.update).toHaveBeenCalledWith({ invalidateAll: true });
		});
		it('muestra errores y recupera valores rechazados', async () => {
			const screen = await renderForm({ values: { amount: '20', description: 'Reintento', paymentMethod: 'Transferencia', paidAt: '2026-10-16', category: 'servicios' }, errors: { amount: 'Monto rechazado', description: 'Revisa la descripción', paidAt: 'Fecha rechazada', paymentMethod: 'Método rechazado' }, message: 'No se pudo guardar.' });
			await expect.element(screen.getByRole('spinbutton', { name: 'Monto (MXN)', exact: true })).toHaveValue(20);
			await expect.element(screen.getByRole('textbox', { name: 'Descripción', exact: true })).toHaveValue('Reintento');
			for (const text of ['Monto rechazado', 'Revisa la descripción', 'Fecha rechazada', 'Método rechazado', 'No se pudo guardar.']) {
				await expect.element(screen.getByText(text, { exact: true })).toBeVisible();
			}
		});
		it('bloquea botones mientras guarda y permite reintentar tras fallo', async () => {
			let resolve!: (result: ActionResult) => void;
			transport.post.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
			const screen = await renderForm();
			await fillForm(screen);
			await screen.getByRole('button', { name: submitLabel, exact: true }).click();
			await expect.element(screen.getByRole('button', { name: 'Guardando...', exact: true })).toBeDisabled();
			await expect.element(screen.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
			resolve({ type: 'failure', status: 400, data: {} });
			await expect.element(screen.getByRole('button', { name: submitLabel, exact: true })).toBeEnabled();
			await expect.element(screen.getByRole('dialog')).toBeVisible();
			await screen.getByRole('button', { name: submitLabel, exact: true }).click();
			await expect.poll(() => transport.post.mock.calls.length).toBe(2);
		});
		if (kind === 'expense') {
			it('requiere categoría para el egreso', async () => {
				const screen = await renderForm({ errors: { category: 'Categoría inválida' } });
				await fillForm(screen);
				await screen.getByRole('combobox', { name: 'Categoría', exact: true }).selectOptions('');
				await screen.getByRole('button', { name: submitLabel, exact: true }).click();
				await expect.element(screen.getByText('Categoría inválida', { exact: true })).toBeVisible();
				expect(transport.post).not.toHaveBeenCalled();
			});
		}
	});
}
