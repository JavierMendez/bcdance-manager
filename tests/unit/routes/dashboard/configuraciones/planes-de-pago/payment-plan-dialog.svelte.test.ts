import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ComponentProps } from 'svelte';
import type { ActionResult } from '@sveltejs/kit';
import PaymentPlanDialog from '$lib/components/payment-plans/payment-plan-dialog.svelte';
import { planValues, planCases } from '../../../../../helpers/payment-plans';
import { transport } from '../../../../../helpers/forms';

vi.mock('$app/forms', () => import('../../../../../helpers/forms'));
vi.mock('$lib/alerts.svelte.js', async () => ({ showError: (await import('../../../../../helpers/forms')).transport.showError, getActionErrorMessage: () => null }));
const renderDialog = (props: Partial<ComponentProps<typeof PaymentPlanDialog>> = {}) => render(PaymentPlanDialog, { open: true, mode: 'create', ...props });
type Screen = Awaited<ReturnType<typeof render>>;
async function fillCommon(screen: Screen) {
	await screen.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Plan de prueba');
	await screen.getByRole('textbox', { name: 'Descripción', exact: true }).fill('Descripción del plan');
	await screen.getByRole('spinbutton', { name: 'Precio', exact: true }).fill('500');
}

describe('campos y modalidades del diálogo de planes', () => {
	it('inicia mensual, sin ID y con clases opcionales', async () => {
		const screen = await renderDialog();
		await expect.element(screen.getByRole('dialog', { name: 'Nuevo plan de pago' })).toBeVisible();
		await expect.element(screen.getByRole('combobox', { name: 'Tipo de plan', exact: true })).toHaveValue('monthly');
		await expect.element(screen.getByRole('combobox', { name: 'Periodicidad', exact: true })).toHaveValue('Mensual');
		await expect.element(screen.getByRole('spinbutton', { name: 'Clases incluidas', exact: true })).not.toBeRequired();
		expect(document.querySelector('input[name="id"]')).toBeNull();
	});
	it('cambia a full pass con 12 horas requeridas y oculta las clases', async () => {
		const screen = await renderDialog();
		await screen.getByRole('combobox', { name: 'Tipo de plan', exact: true }).selectOptions('full_pass');
		await expect.element(screen.getByRole('spinbutton', { name: 'Horas incluidas', exact: true })).toHaveValue(12);
		await expect.element(screen.getByRole('spinbutton', { name: 'Horas incluidas', exact: true })).toBeRequired();
		await expect.element(screen.getByRole('spinbutton', { name: 'Clases incluidas', exact: true })).not.toBeInTheDocument();
	});
	it('fuerza periodicidad Por clase y vuelve a mostrar el selector al cambiar a mensual', async () => {
		const screen = await renderDialog();
		const type = screen.getByRole('combobox', { name: 'Tipo de plan', exact: true });
		await type.selectOptions('drop_in');
		await expect.element(screen.getByLabelText('Periodicidad', { exact: true })).toHaveValue('Por clase');
		await expect.element(screen.getByLabelText('Periodicidad', { exact: true })).toBeDisabled();
		expect(document.querySelector<HTMLInputElement>('input[name="billingPeriod"]')?.value).toBe('Por clase');
		await type.selectOptions('monthly');
		await expect.element(screen.getByRole('combobox', { name: 'Periodicidad', exact: true })).toBeEnabled();
	});
	it('cancela sin enviar y notifica el cierre', async () => {
		const onClosed = vi.fn();
		const screen = await renderDialog({ onClosed });
		await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(onClosed).toHaveBeenCalledOnce();
		expect(transport.post).not.toHaveBeenCalled();
	});
	it.each(['Nombre', 'Descripción', 'Precio'])('impide enviar sin %s', async (label) => {
		const screen = await renderDialog(); await fillCommon(screen);
		if (label === 'Precio') await screen.getByRole('spinbutton', { name: label, exact: true }).fill('');
		else await screen.getByRole('textbox', { name: label, exact: true }).fill('');
		await screen.getByRole('button', { name: 'Crear plan', exact: true }).click();
		expect(transport.post).not.toHaveBeenCalled();
	});
	it.each(['0', '-1', '1.5'])('rechaza precio %s mediante restricciones HTML', async (price) => {
		const screen = await renderDialog(); await fillCommon(screen);
		await screen.getByRole('spinbutton', { name: 'Precio', exact: true }).fill(price);
		await screen.getByRole('button', { name: 'Crear plan', exact: true }).click();
		expect(transport.post).not.toHaveBeenCalled();
	});
	it.each(['', '0', '1.5'])('impide full pass con horas %j', async (hours) => {
		const screen = await renderDialog(); await fillCommon(screen);
		await screen.getByRole('combobox', { name: 'Tipo de plan', exact: true }).selectOptions('full_pass');
		await screen.getByRole('spinbutton', { name: 'Horas incluidas', exact: true }).fill(hours);
		await screen.getByRole('button', { name: 'Crear plan', exact: true }).click();
		expect(transport.post).not.toHaveBeenCalled();
	});
	it('restaura valores rechazados y muestra errores accesibles', async () => {
		const screen = await renderDialog({ values: { ...planValues, name: '', price: '0' }, errors: { name: 'Nombre obligatorio', description: 'Revisa descripción', price: 'Precio inválido', billingPeriod: 'Periodo inválido', classesIncluded: 'Clases inválidas', planType: 'Tipo inválido' } });
		for (const text of ['Nombre obligatorio', 'Revisa descripción', 'Precio inválido', 'Periodo inválido', 'Clases inválidas', 'Tipo inválido']) {
			await expect.element(screen.getByText(text, { exact: true })).toBeVisible();
		}
		await expect.element(screen.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue('');
		await expect.element(screen.getByRole('spinbutton', { name: 'Precio', exact: true })).toHaveValue(0);
		for (const label of ['Nombre', 'Descripción', 'Precio', 'Periodicidad', 'Clases incluidas']) {
			await expect.element(screen.getByLabelText(label, { exact: true })).toHaveAttribute('aria-invalid', 'true');
		}
	});
	it('muestra errores específicos de horas al recuperar un full pass', async () => {
		const screen = await renderDialog({ values: { ...planValues, planType: 'full_pass', hoursIncluded: '0' }, errors: { hoursIncluded: 'Horas inválidas' } });
		await expect.element(screen.getByText('Horas inválidas', { exact: true })).toBeVisible();
		await expect.element(screen.getByRole('spinbutton', { name: 'Horas incluidas', exact: true })).toHaveAttribute('aria-invalid', 'true');
	});
});

for (const mode of ['create', 'edit'] as const) {
	describe(`envío de diálogo en modo ${mode}`, () => {
		it.each(planCases)('envía $type con los campos y callback correctos', async ({ type, plan }) => {
			const onSuccess = vi.fn(); const onClosed = vi.fn();
			transport.post.mockResolvedValue({ type: 'success', status: 200, data: { paymentPlan: plan } });
			const screen = await renderDialog({ mode, paymentPlan: mode === 'edit' ? plan : null, onSuccess, onClosed });
			await fillCommon(screen);
			await screen.getByRole('combobox', { name: 'Tipo de plan', exact: true }).selectOptions(type);
			await screen.getByRole('button', { name: mode === 'create' ? 'Crear plan' : 'Guardar cambios', exact: true }).click();
			await expect.poll(() => onSuccess.mock.calls.length).toBe(1);
			const [body, action] = transport.post.mock.calls[0];
			expect(action).toBe(mode === 'create' ? '?/create' : '?/update');
			expect(body.get('id')).toBe(mode === 'create' ? null : String(plan.id));
			expect(body.get('planType')).toBe(type);
			expect(body.get('name')).toBe('Plan de prueba');
			expect(body.get('price')).toBe('500');
			if (type === 'full_pass') {
				expect(body.get('hoursIncluded')).toBe('12');
				expect(body.has('classesIncluded')).toBe(false);
			} else expect(body.has('hoursIncluded')).toBe(false);
			if (type === 'drop_in') expect(body.get('billingPeriod')).toBe('Por clase');
			expect(onClosed).toHaveBeenCalledOnce();
			expect(onSuccess).toHaveBeenCalledExactlyOnceWith({ paymentPlan: plan });
			await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		});
	});
}

it('bloquea controles de envío, conserva el diálogo tras fallo y permite reintentar', async () => {
	let resolve!: (result: ActionResult) => void;
	transport.post.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
	const screen = await renderDialog(); await fillCommon(screen);
	await screen.getByRole('button', { name: 'Crear plan', exact: true }).click();
	await expect.element(screen.getByRole('button', { name: 'Guardando...', exact: true })).toBeDisabled();
	await expect.element(screen.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
	resolve({ type: 'failure', status: 400, data: { message: 'No se pudo guardar.' } });
	await expect.element(screen.getByRole('button', { name: 'Crear plan', exact: true })).toBeEnabled();
	await expect.element(screen.getByRole('dialog')).toBeVisible();
	expect(transport.showError).toHaveBeenCalledWith('No se pudo guardar.');
	await screen.getByRole('button', { name: 'Crear plan', exact: true }).click();
	await expect.poll(() => transport.post.mock.calls.length).toBe(2);
});
