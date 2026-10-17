import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ComponentProps } from 'svelte';
import AttendancePage from '../../../../../src/routes/dashboard/clases/asistencia/+page.svelte';
import { classGroup, member, fullPassStudent, dropInPlan } from '../../../../helpers/classes';
import { transport } from '../../../../helpers/forms';

vi.mock('$app/forms', () => import('../../../../helpers/forms'));
vi.mock('$app/navigation', async () => ({ goto: (await import('../../../../helpers/forms')).transport.goto }));
type Data = ComponentProps<typeof AttendancePage>['data'];
function dataWith(overrides: Partial<Data> = {}): Data {
	return { course: classGroup, courses: [{ id: 10, name: 'Salsa' }], sessionDate: '2026-10-16', sessionDateLabel: 'viernes 16 de octubre de 2026',
		attendanceEditable: true, attendanceValidationError: null, members: [member], eligibleFullPassStudents: [fullPassStudent], eligibleStudents: [],
		dropInPlans: [dropInPlan], sessionDropInPayments: [], paymentMethods: ['Efectivo'], ...overrides } as Data;
}

describe('página de registro de asistencia', () => {
	it('sin clase seleccionada no permite cargar alumnos ni guardar', async () => {
		const screen = await render(AttendancePage, { data: dataWith({ course: null, members: [] }), form: null });
		await expect.element(screen.getByRole('button', { name: 'Cargar alumnos' })).toBeDisabled();
		await expect.element(screen.getByRole('button', { name: 'Guardar asistencia' })).not.toBeInTheDocument();
	});
	it('explica cómo agregar alumnos cuando la lista inicial está vacía', async () => {
		const screen = await render(AttendancePage, { data: dataWith({ members: [] }), form: null });
		await expect.element(screen.getByText(/No hay alumnos con inscripción mensual vigente/)).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Agregar full pass' })).toBeEnabled();
	});
	it('exige marcar todos los alumnos y envía sus identificadores y estados', async () => {
		const screen = await render(AttendancePage, { data: dataWith({ members: [member, { ...member, studentId: 3, entitlementId: 23, fullName: 'María' }] }), form: null });
		const save = screen.getByRole('button', { name: 'Guardar asistencia' });
		await expect.element(save).toBeDisabled();
		await screen.getByLabelText('Asistió', { exact: true }).first().click();
		await expect.element(save).toBeDisabled();
		await screen.getByLabelText('Falta', { exact: true }).nth(1).click();
		await expect.element(save).toBeEnabled();
		await save.click();
		await expect.poll(() => transport.post.mock.calls.length).toBe(1);
		const [body, action] = transport.post.mock.calls[0];
		expect(action).toBe('?/save');
		expect(body.get('groupId')).toBe('10');
		expect(JSON.parse(String(body.get('entries')))).toEqual([
			{ studentId: 1, entitlementId: 20, status: 'attended' },
			{ studentId: 3, entitlementId: 23, status: 'absent' }
		]);
	});
	it('bloquea alumnos sin pago vigente y los excluye del envío', async () => {
		const screen = await render(AttendancePage, { data: dataWith({ members: [{ ...member, canRegisterAttendance: false }] }), form: null });
		await expect.element(screen.getByText('Pago no vigente', { exact: true })).toBeVisible();
		await expect.element(screen.getByLabelText('Asistió', { exact: true })).toBeDisabled();
		await expect.element(screen.getByRole('button', { name: 'Guardar asistencia' })).toBeDisabled();
		expect(screen.container.querySelector<HTMLInputElement>('input[name="entries"]')?.value).toBe('[]');
	});
	it('bloquea cambios y respeta los límites de fechas de una sesión no editable', async () => {
		const screen = await render(AttendancePage, { data: dataWith({ attendanceEditable: false, attendanceValidationError: 'Clase desactivada', course: { ...classGroup, startDate: '2026-10-01', endDate: '2026-10-31' } }), form: null });
		await expect.element(screen.getByText('Clase desactivada', { exact: true })).toBeVisible();
		for (const name of ['Agregar full pass', 'Pago por clase', 'Guardar asistencia']) {
			await expect.element(screen.getByRole('button', { name, exact: true })).toBeDisabled();
		}
		await expect.element(screen.getByLabelText('Fecha de clase', { exact: true })).toHaveAttribute('min', '2026-10-01');
		await expect.element(screen.getByLabelText('Fecha de clase', { exact: true })).toHaveAttribute('max', '2026-10-31');
	});
	it('agrega full pass sin duplicados, cancela la eliminación y luego la confirma', async () => {
		const screen = await render(AttendancePage, { data: dataWith(), form: null });
		await screen.getByRole('button', { name: 'Agregar full pass' }).click();
		await screen.getByRole('button', { name: /Luis López/ }).click();
		await expect.element(screen.getByRole('cell', { name: 'Luis López', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Agregar full pass' })).toBeDisabled();
		await screen.getByRole('button', { name: 'Quitar a Luis López', exact: true }).click();
		await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
		await expect.element(screen.getByRole('cell', { name: 'Luis López', exact: true })).toBeVisible();
		await screen.getByRole('button', { name: 'Quitar a Luis López', exact: true }).click();
		await screen.getByRole('button', { name: 'Quitar', exact: true }).click();
		await expect.element(screen.getByRole('cell', { name: 'Luis López', exact: true })).not.toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: 'Agregar full pass' })).toBeEnabled();
	});
	it('separa créditos por clase y muestra pagos sin alumno y descuentos', async () => {
		const screen = await render(AttendancePage, { data: dataWith({
			members: [{ ...member, entitlementType: 'drop_in', modalityLabel: 'Por clase', classesRemaining: 1 }],
			sessionDropInPayments: [{ paymentId: 1, studentId: null, studentName: 'Sin alumno', planName: 'Clase suelta', totalAmount: 90, discountPercent: 10, paymentMethod: 'Efectivo', classesGranted: 1, attendanceStatus: null }]
		}), form: null });
		await expect.element(screen.getByRole('heading', { name: 'Pagos por clase', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: 'Solo pago', exact: true })).toBeVisible();
		await expect.element(screen.getByText('Desc. 10%', { exact: true })).toBeVisible();
	});
	it('precarga marcas ya guardadas y muestra cambios pendientes', async () => {
		const screen = await render(AttendancePage, { data: dataWith({ members: [{ ...member, currentStatus: 'attended' }] }), form: null });
		await expect.element(screen.getByText('Registrado en esta sesión')).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Guardar asistencia' })).toBeEnabled();
		await screen.getByLabelText('Falta', { exact: true }).click();
		await expect.element(screen.getByText('Cambio sin guardar')).toBeVisible();
	});
});
