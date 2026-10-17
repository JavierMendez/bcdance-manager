import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ComponentProps } from 'svelte';
import type { ActionResult } from '@sveltejs/kit';
import PaymentWizard from '$lib/components/payments/payment-wizard.svelte';
import RegisterPage from '../../../../../src/routes/dashboard/pagos/registrar/+page.svelte';
import type { PurchaseType } from '$lib/payments';
import { authData, wizardProps, wizardValues } from '../../../../helpers/payments';
import { transport } from '../../../../helpers/forms';

const { pageState } = vi.hoisted(() => ({ pageState: { url: new URL('http://localhost/dashboard/pagos/registrar') } }));
vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('$app/forms', () => import('../../../../helpers/forms'));
vi.mock('$app/navigation', async () => ({ goto: (await import('../../../../helpers/forms')).transport.goto }));
beforeEach(() => { pageState.url = new URL('http://localhost/dashboard/pagos/registrar'); });

type Screen = Awaited<ReturnType<typeof render>>;
const next = (screen: Screen) => screen.getByRole('button', { name: 'Siguiente', exact: true }).click();
const purchaseMatchers: Record<PurchaseType, RegExp> = {
	monthly_only: /^Plan mensual para una clase /,
	full_pass_only: /^Full pass [(]12 horas[)] /,
	combined: /^Plan mensual [+] Full pass /,
	drop_in_only: /^Clase suelta [(]por clase[)] /
};
async function renderWizard(props: Partial<ComponentProps<typeof PaymentWizard>> = {}) {
	return render(PaymentWizard, { ...wizardProps, ...props });
}
async function goToDetail(screen: Screen, type: PurchaseType = 'monthly_only', withStudent = true) {
	if (withStudent) await screen.getByRole('combobox', { name: 'Alumno', exact: true }).selectOptions('1');
	await next(screen);
	await screen.getByRole('button', { name: purchaseMatchers[type] }).click();
	await next(screen);
}
async function fillDetails(screen: Screen, type: PurchaseType = 'monthly_only') {
	if (type !== 'full_pass_only') await screen.getByRole('combobox', { name: 'Clase', exact: true }).selectOptions('10');
	if (type === 'monthly_only' || type === 'combined') await screen.getByRole('combobox', { name: 'Plan mensual', exact: true }).selectOptions('1');
	if (type === 'full_pass_only' || type === 'combined') await screen.getByRole('combobox', { name: 'Plan full pass', exact: true }).selectOptions('2');
	if (type === 'drop_in_only') await screen.getByRole('combobox', { name: 'Plan por clase', exact: true }).selectOptions('3');
	await next(screen);
}

describe('página de registro y preselecciones por URL', () => {
	it.each(['groupId', 'courseId'])('precarga alumno y clase con el parámetro %s', async (parameter) => {
		pageState.url = new URL(`http://localhost/dashboard/pagos/registrar?studentId=1&${parameter}=10`);
		const screen = await render(RegisterPage, { data: { ...authData, ...wizardProps }, form: null });
		await expect.element(screen.getByRole('heading', { name: 'Registrar pago', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('combobox', { name: 'Alumno', exact: true })).toHaveValue('1');
		await next(screen);
		await next(screen);
		await expect.element(screen.getByRole('combobox', { name: 'Clase', exact: true })).toHaveValue('10');
	});
	it('da prioridad a groupId sobre courseId', async () => {
		pageState.url = new URL('http://localhost/dashboard/pagos/registrar?studentId=1&groupId=10&courseId=99');
		const screen = await render(RegisterPage, { data: { ...authData, ...wizardProps }, form: null });
		await next(screen);
		await next(screen);
		await expect.element(screen.getByRole('combobox', { name: 'Clase', exact: true })).toHaveValue('10');
	});
});

describe('cinco pasos del asistente de pagos', () => {
	it('inicia en alumno, deshabilita Anterior y no envía al avanzar', async () => {
		const screen = await renderWizard();
		await expect.element(screen.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
		await next(screen);
		await expect.element(screen.getByRole('button', { name: /^Clase suelta \(por clase\)/ })).toBeVisible();
		expect(transport.post).not.toHaveBeenCalled();
	});
	it.each(['monthly_only', 'full_pass_only', 'combined'] as const)('impide elegir %s sin alumno', async (type) => {
		const screen = await renderWizard();
		await next(screen);
		await screen.getByRole('button', { name: purchaseMatchers[type] }).click();
		await next(screen);
		await expect.element(screen.getByRole('button', { name: purchaseMatchers[type] })).toBeVisible();
		await expect.element(screen.getByRole('combobox', { name: 'Clase', exact: true })).not.toBeInTheDocument();
		expect(transport.post).not.toHaveBeenCalled();
	});
	it.each(['monthly_only', 'full_pass_only', 'combined', 'drop_in_only'] as const)('recorre %s, confirma y envía los datos correctos', async (type) => {
		transport.post.mockResolvedValue({ type: 'redirect', status: 303, location: '/dashboard/pagos' });
		const screen = await renderWizard();
		await goToDetail(screen, type);
		await fillDetails(screen, type);
		await screen.getByRole('combobox', { name: 'Método de pago', exact: true }).selectOptions('Transferencia');
		await screen.getByRole('spinbutton', { name: 'Descuento (%)', exact: true }).fill('10');
		await screen.getByRole('textbox', { name: 'Notas', exact: true }).fill('Pago de prueba');
		await next(screen);
		await expect.element(screen.getByRole('button', { name: 'Registrar pago', exact: true })).toBeVisible();
		await screen.getByRole('button', { name: 'Registrar pago', exact: true }).click();
		await expect.poll(() => transport.goto.mock.calls.length).toBe(1);
		const [body, action] = transport.post.mock.calls[0];
		expect(action).toBe('?/register');
		expect(body.get('purchaseType')).toBe(type);
		expect(body.get('studentId')).toBe('1');
		expect(body.get('paymentMethod')).toBe('Transferencia');
		expect(body.get('discountPercent')).toBe('10');
		expect(body.get('notes')).toBe('Pago de prueba');
		expect(body.get('paidAt')).toBeTruthy();
		if (type !== 'full_pass_only') expect(body.get('groupId')).toBe('10');
	});
	it('permite pago ocasional sin alumno y sin teléfono', async () => {
		const screen = await renderWizard({ students: [] });
		await goToDetail(screen, 'drop_in_only', false);
		await fillDetails(screen, 'drop_in_only');
		await next(screen);
		await expect.element(screen.getByText('Sin alumno', { exact: true })).toBeVisible();
		await screen.getByRole('button', { name: 'Registrar pago', exact: true }).click();
		await expect.poll(() => transport.post.mock.calls.length).toBe(1);
		expect(transport.post.mock.calls[0][0].get('studentId')).toBe('');
	});
	it.each(['monthly_only', 'full_pass_only', 'drop_in_only'] as const)('muestra el catálogo vacío para %s y bloquea avance sin plan', async (type) => {
		const screen = await renderWizard({ plans: [] });
		await goToDetail(screen, type);
		await expect.element(screen.getByText(/No hay planes/)).toBeVisible();
		await next(screen);
		await expect.element(screen.getByRole('combobox', { name: 'Método de pago', exact: true })).not.toBeInTheDocument();
		expect(transport.post).not.toHaveBeenCalled();
	});
	it('exige clase y plan mensual y permite corregirlos', async () => {
		const screen = await renderWizard();
		await goToDetail(screen);
		await next(screen);
		await expect.element(screen.getByText('Selecciona una clase.', { exact: true })).toBeVisible();
		await expect.element(screen.getByText('Selecciona un plan mensual.', { exact: true })).toBeVisible();
		await fillDetails(screen);
		await expect.element(screen.getByRole('combobox', { name: 'Método de pago', exact: true })).toBeVisible();
	});
	it.each(['-1', '101', '0.5'])('rechaza descuento %s antes de confirmar', async (discount) => {
		const screen = await renderWizard();
		await goToDetail(screen);
		await fillDetails(screen);
		await screen.getByRole('spinbutton', { name: 'Descuento (%)', exact: true }).fill(discount);
		await next(screen);
		await expect.element(screen.getByText('Ingresa un descuento válido entre 0 y 100.', { exact: true })).toBeVisible();
		expect(transport.post).not.toHaveBeenCalled();
	});
	it.each(['0', '100'])('acepta descuento límite %s y conserva datos al volver atrás', async (discount) => {
		const screen = await renderWizard();
		await goToDetail(screen);
		await fillDetails(screen);
		await screen.getByRole('spinbutton', { name: 'Descuento (%)', exact: true }).fill(discount);
		await next(screen);
		await expect.element(screen.getByRole('button', { name: 'Registrar pago', exact: true })).toBeVisible();
		await screen.getByRole('button', { name: 'Anterior', exact: true }).click();
		await expect.element(screen.getByRole('spinbutton', { name: 'Descuento (%)', exact: true })).toHaveValue(Number(discount));
		await screen.getByRole('button', { name: 'Anterior', exact: true }).click();
		await expect.element(screen.getByRole('combobox', { name: 'Plan mensual', exact: true })).toHaveValue('1');
	});
	it('bloquea el envío pendiente, conserva el formulario tras fallo y permite reintentar', async () => {
		let resolve!: (result: ActionResult) => void;
		transport.post.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
		const screen = await renderWizard();
		await goToDetail(screen);
		await fillDetails(screen);
		await next(screen);
		await screen.getByRole('button', { name: 'Registrar pago', exact: true }).click();
		await expect.element(screen.getByRole('button', { name: 'Registrando...', exact: true })).toBeDisabled();
		await expect.element(screen.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
		resolve({ type: 'failure', status: 400, data: { errors: { studentId: 'Alumno no disponible.' } } });
		await expect.element(screen.getByRole('button', { name: 'Registrar pago', exact: true })).toBeEnabled();
		expect(transport.goto).not.toHaveBeenCalled();
		transport.post.mockResolvedValueOnce({ type: 'redirect', status: 303, location: '/dashboard/pagos' });
		await screen.getByRole('button', { name: 'Registrar pago', exact: true }).click();
		await expect.poll(() => transport.goto.mock.calls.length).toBe(1);
		expect(transport.post).toHaveBeenCalledTimes(2);
	});
	it('recibe errores del servidor en la confirmación y conserva valores para corregir', async () => {
		const screen = await render(RegisterPage, { data: { ...authData, ...wizardProps }, form: { errors: { studentId: 'El alumno no existe.' }, values: { ...wizardValues, studentMode: 'existing', newFullName: '', newPhone: '' } } });
		await expect.element(screen.getByText('Alumno: El alumno no existe.', { exact: true })).toBeVisible();
		await screen.getByRole('button', { name: 'Anterior', exact: true }).click();
		await expect.element(screen.getByRole('spinbutton', { name: 'Descuento (%)', exact: true })).toHaveValue(0);
	});
});
