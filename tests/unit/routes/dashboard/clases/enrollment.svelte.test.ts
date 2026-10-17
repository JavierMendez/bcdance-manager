import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ComponentProps } from 'svelte';
import EnrollmentPage from '../../../../../src/routes/dashboard/clases/[groupId]/inscribir/+page.svelte';
import { student, monthlyPlan, fullPassPlan, dropInPlan, now } from '../../../../helpers/classes';
import { transport } from '../../../../helpers/forms';
import { PAYMENT_METHODS } from '$lib/payments';

vi.mock('$app/forms', () => import('../../../../helpers/forms'));
vi.mock('$app/navigation', async () => ({ goto: (await import('../../../../helpers/forms')).transport.goto }));
type Data = ComponentProps<typeof EnrollmentPage>['data'];
const data: Data = {
	classGroup: { id: 10, name: 'Salsa' }, students: [student], enrolledStudentIds: [],
	courses: [{ id: 10, name: 'Salsa' }], plans: [monthlyPlan, fullPassPlan, dropInPlan], paymentMethods: PAYMENT_METHODS,
	role: 'admin', user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com', emailVerified: true,
		createdAt: now, updatedAt: now, role: 'admin', banned: false, banReason: null, banExpires: null }
};
const next = (screen: Awaited<ReturnType<typeof render>>) => screen.getByRole('button', { name: 'Siguiente', exact: true }).click();

describe('inscripción y asistente de pago en modo enrollment', () => {
	it('enlaza a la clase e impide avanzar sin alumno', async () => {
		const screen = await render(EnrollmentPage, { data, form: null });
		await expect.element(screen.getByRole('link', { name: 'Volver a la clase' })).toHaveAttribute('href', '/dashboard/clases/10');
		await next(screen);
		await expect.element(screen.getByText('Selecciona un alumno.', { exact: true })).toBeVisible();
		expect(transport.post).not.toHaveBeenCalled();
	});
	it('rechaza un alumno ya inscrito', async () => {
		const screen = await render(EnrollmentPage, { data: { ...data, enrolledStudentIds: [1] }, form: null });
		await screen.getByRole('combobox', { name: 'Alumno', exact: true }).selectOptions('1');
		await expect.element(screen.getByText('Este alumno ya está inscrito en esta clase.', { exact: true })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
	});
	it('requiere nombre para alumno nuevo y permite teléfono opcional', async () => {
		const screen = await render(EnrollmentPage, { data, form: null });
		await screen.getByRole('button', { name: 'Nuevo alumno', exact: true }).click();
		await next(screen);
		await expect.element(screen.getByText('El nombre completo es obligatorio.', { exact: true })).toBeVisible();
		await screen.getByRole('textbox', { name: 'Nombre completo', exact: true }).fill('María');
		await next(screen);
		await expect.element(screen.getByRole('button', { name: /^Mensual salsa Plan/ })).toBeVisible();
	});
	it('muestra modalidades vacías y no permite continuar sin plan', async () => {
		const screen = await render(EnrollmentPage, { data: { ...data, plans: [] }, form: null });
		await screen.getByRole('combobox', { name: 'Alumno', exact: true }).selectOptions('1');
		await next(screen);
		await expect.element(screen.getByText(/No hay planes/)).toBeVisible();
		await next(screen);
		await expect.element(screen.getByRole('button', { name: 'Inscribir alumno', exact: true })).not.toBeInTheDocument();
	});
	it.each(['monthly', 'full_pass', 'drop_in', 'combined'] as const)('inscribe con modalidad %s y mantiene fija la clase', async (type) => {
		transport.post.mockResolvedValue({ type: 'redirect', status: 303, location: '/dashboard/clases/10' });
		const screen = await render(EnrollmentPage, { data, form: null });
		await screen.getByRole('combobox', { name: 'Alumno', exact: true }).selectOptions('1');
		await next(screen);
		const modality = type === 'monthly' ? /^Mensual salsa Plan/ : type === 'full_pass' ? /^Pase 12 horas Plan/ : type === 'drop_in' ? /^Clase suelta Plan/ : /^Mensual salsa \+ Pase 12 horas/;
		await screen.getByRole('button', { name: modality }).click();
		await next(screen);
		await screen.getByRole('spinbutton', { name: 'Descuento (%)', exact: true }).fill('100');
		await next(screen);
		await screen.getByRole('button', { name: 'Inscribir alumno', exact: true }).click();
		await expect.poll(() => transport.goto.mock.calls.length).toBe(1);
		const [body] = transport.post.mock.calls[0];
		expect(body.get('groupId')).toBe('10');
		expect(body.get('studentId')).toBe('1');
		expect(body.get('discountPercent')).toBe('100');
		expect(body.get('purchaseType')).toBe({ monthly: 'monthly_only', full_pass: 'full_pass_only', drop_in: 'drop_in_only', combined: 'combined' }[type]);
	});
});
