import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ComponentProps } from 'svelte';
import PaymentPlansPage from '../../../../../../src/routes/dashboard/configuraciones/planes-de-pago/+page.svelte';
import type { SerializedPaymentPlan } from '$lib/payment-plans';
import { monthlyPlan, fullPassPlan, dropInPlan } from '../../../../../helpers/classes';
import { planValues } from '../../../../../helpers/payment-plans';
import { authData } from '../../../../../helpers/payments';
import { transport } from '../../../../../helpers/forms';

vi.mock('$app/forms', () => import('../../../../../helpers/forms'));
vi.mock('$lib/alerts.svelte.js', async () => ({ showError: (await import('../../../../../helpers/forms')).transport.showError, getActionErrorMessage: () => null }));
type Data = ComponentProps<typeof PaymentPlansPage>['data'];
const dataWith = (paymentPlans: SerializedPaymentPlan[] = [monthlyPlan, fullPassPlan, dropInPlan]): Data => ({ ...authData, paymentPlans });

describe('catálogo de planes de pago', () => {
	it('muestra catálogo vacío y permite abrir un alta', async () => {
		const screen = await render(PaymentPlansPage, { data: dataWith([]), form: null });
		await expect.element(screen.getByRole('heading', { name: 'Planes de pago', exact: true })).toBeVisible();
		await expect.element(screen.getByText('No hay planes de pago registrados.', { exact: true })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Editar', exact: true })).not.toBeInTheDocument();
		await screen.getByRole('button', { name: 'Nuevo plan', exact: true }).click();
		await expect.element(screen.getByRole('dialog', { name: 'Nuevo plan de pago' })).toBeVisible();
	});
	it('muestra los tres tipos, periodicidades y cantidades incluidas', async () => {
		const screen = await render(PaymentPlansPage, { data: dataWith([monthlyPlan, fullPassPlan, { ...dropInPlan, classesIncluded: 2 }]), form: null });
		for (const text of ['Plan mensual', 'Full pass', '12 horas', '2 clases', '—', 'Mensual salsa', 'Pase 12 horas', 'Clase suelta']) {
			await expect.element(screen.getByRole('cell', { name: text, exact: true })).toBeVisible();
		}
		expect(screen.getByRole('button', { name: 'Editar', exact: true }).elements()).toHaveLength(3);
	});
	it('maneja cantidades nulas sin mostrar null ni undefined', async () => {
		const screen = await render(PaymentPlansPage, { data: dataWith([monthlyPlan, { ...fullPassPlan, hoursIncluded: null }]), form: null });
		expect(screen.getByRole('cell', { name: '—', exact: true }).elements()).toHaveLength(2);
		expect(screen.container.textContent).not.toMatch(/null|undefined/);
	});
	it.each([[1, '$1'], [1000000, '$1,000,000']] as const)('presenta precio %s en MXN', async (price, formatted) => {
		const screen = await render(PaymentPlansPage, { data: dataWith([{ ...monthlyPlan, price }]), form: null });
		await expect.element(screen.getByRole('cell', { name: formatted, exact: true })).toBeVisible();
	});
	it('escapa contenido de nombres y descripciones y conserva textos largos', async () => {
		const name = '<img src=x onerror=alert(1)>';
		const description = `Descripción ${'á'.repeat(300)}`;
		const screen = await render(PaymentPlansPage, { data: dataWith([{ ...monthlyPlan, name, description }]), form: null });
		await expect.element(screen.getByRole('cell', { name, exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: description, exact: true })).toBeVisible();
		expect(screen.container.querySelector('img')).toBeNull();
	});
});

describe('alta y edición desde el catálogo', () => {
	it('inserta el plan creado al principio y elimina el estado vacío', async () => {
		transport.post.mockResolvedValue({ type: 'success', status: 200, data: { paymentPlan: monthlyPlan } });
		const screen = await render(PaymentPlansPage, { data: dataWith([]), form: null });
		await screen.getByRole('button', { name: 'Nuevo plan', exact: true }).click();
		await screen.getByRole('textbox', { name: 'Nombre', exact: true }).fill(monthlyPlan.name);
		await screen.getByRole('textbox', { name: 'Descripción', exact: true }).fill(monthlyPlan.description);
		await screen.getByRole('spinbutton', { name: 'Precio', exact: true }).fill('500');
		await screen.getByRole('button', { name: 'Crear plan', exact: true }).click();
		await expect.element(screen.getByRole('cell', { name: monthlyPlan.name, exact: true })).toBeVisible();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		await expect.element(screen.getByText('No hay planes de pago registrados.', { exact: true })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Editar', exact: true }).elements()).toHaveLength(1);
	});
	it('precarga el plan seleccionado e incluye su identificador', async () => {
		const screen = await render(PaymentPlansPage, { data: dataWith(), form: null });
		await screen.getByRole('button', { name: 'Editar', exact: true }).nth(1).click();
		await expect.element(screen.getByRole('dialog', { name: 'Editar plan de pago' })).toBeVisible();
		await expect.element(screen.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue(fullPassPlan.name);
		await expect.element(screen.getByRole('spinbutton', { name: 'Precio', exact: true })).toHaveValue(700);
		await expect.element(screen.getByRole('spinbutton', { name: 'Horas incluidas', exact: true })).toHaveValue(12);
		expect(document.querySelector<HTMLInputElement>('input[name="id"]')?.value).toBe('2');
	});
	it('reemplaza los datos del plan editado sin duplicarlo ni modificar los demás', async () => {
		const saved = { ...fullPassPlan, id: 1, name: 'Full pass actualizado', price: 999, hoursIncluded: 24 };
		transport.post.mockResolvedValue({ type: 'success', status: 200, data: { paymentPlan: saved } });
		const screen = await render(PaymentPlansPage, { data: dataWith([monthlyPlan, dropInPlan]), form: null });
		await screen.getByRole('button', { name: 'Editar', exact: true }).first().click();
		await screen.getByRole('combobox', { name: 'Tipo de plan', exact: true }).selectOptions('full_pass');
		await screen.getByRole('spinbutton', { name: 'Horas incluidas', exact: true }).fill('24');
		await screen.getByRole('textbox', { name: 'Nombre', exact: true }).fill(saved.name);
		await screen.getByRole('spinbutton', { name: 'Precio', exact: true }).fill('999');
		await screen.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		for (const text of [saved.name, '24 horas', '$999', dropInPlan.name]) await expect.element(screen.getByRole('cell', { name: text, exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: monthlyPlan.name, exact: true })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Editar', exact: true }).elements()).toHaveLength(2);
	});
	it('cancela un borrador y abre otro plan con sus propios valores', async () => {
		const screen = await render(PaymentPlansPage, { data: dataWith(), form: null });
		await screen.getByRole('button', { name: 'Editar', exact: true }).first().click();
		await screen.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Borrador');
		await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		await screen.getByRole('button', { name: 'Editar', exact: true }).nth(1).click();
		await expect.element(screen.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue(fullPassPlan.name);
		expect(transport.post).not.toHaveBeenCalled();
	});
	it.each(['create', 'edit'] as const)('abre los valores y errores del servidor en modo %s', async (mode) => {
		const form = mode === 'create'
			? { mode, errors: { price: 'Precio inválido' }, values: { ...planValues, price: '0' } }
			: { mode, id: 1, errors: { price: 'Precio inválido' }, values: { ...planValues, price: '0' } };
		const screen = await render(PaymentPlansPage, { data: dataWith(), form });
		await expect.element(screen.getByRole('dialog', { name: mode === 'create' ? 'Nuevo plan de pago' : 'Editar plan de pago' })).toBeVisible();
		await expect.element(screen.getByText('Precio inválido', { exact: true })).toBeVisible();
		await expect.element(screen.getByRole('spinbutton', { name: 'Precio', exact: true })).toHaveValue(0);
	});
	it('conserva el catálogo y el diálogo tras rechazar el guardado', async () => {
		transport.post.mockResolvedValue({ type: 'failure', status: 404, data: { message: 'Plan de pago no encontrado.' } });
		const screen = await render(PaymentPlansPage, { data: dataWith(), form: null });
		await screen.getByRole('button', { name: 'Editar', exact: true }).first().click();
		await screen.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Cambio rechazado');
		await screen.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
		await expect.poll(() => transport.update.mock.calls.length).toBe(1);
		await expect.element(screen.getByRole('dialog')).toBeVisible();
		await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
		await expect.element(screen.getByRole('cell', { name: monthlyPlan.name, exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: 'Cambio rechazado', exact: true })).not.toBeInTheDocument();
	});
});
