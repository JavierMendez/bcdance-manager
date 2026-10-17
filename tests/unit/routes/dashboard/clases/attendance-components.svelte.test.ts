import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AttendanceStatusToggle from '$lib/components/attendance/attendance-status-toggle.svelte';
import FullPassStudentPicker from '$lib/components/attendance/full-pass-student-picker.svelte';
import DropInQuickRegisterDialog from '$lib/components/attendance/drop-in-quick-register-dialog.svelte';
import { fullPassStudent, dropInPlan, student } from '../../../../helpers/classes';
import { transport } from '../../../../helpers/forms';

vi.mock('$app/forms', () => import('../../../../helpers/forms'));
vi.mock('$app/navigation', async () => ({ goto: (await import('../../../../helpers/forms')).transport.goto }));

describe('selector de asistencia', () => {
	it('solicita una marca inicial y comunica asistencia y falta', async () => {
		const onValueChange = vi.fn();
		const screen = await render(AttendanceStatusToggle, { value: '', onValueChange });
		await expect.element(screen.getByText('Selecciona asistencia o falta')).toBeVisible();
		await screen.getByLabelText('Asistió', { exact: true }).click();
		expect(onValueChange).toHaveBeenLastCalledWith('attended');
		await screen.getByLabelText('Falta', { exact: true }).click();
		expect(onValueChange).toHaveBeenLastCalledWith('absent');
	});
	it.each([
		['attended', 'attended', 'Registrado en esta sesión'],
		['absent', 'attended', 'Cambio sin guardar']
	] as const)('distingue valor %s de guardado %s', async (value, savedStatus, message) => {
		const screen = await render(AttendanceStatusToggle, { value, savedStatus, onValueChange: vi.fn() });
		await expect.element(screen.getByText(message, { exact: true })).toBeVisible();
	});
	it('deshabilita ambas opciones cuando el registro no es editable', async () => {
		const screen = await render(AttendanceStatusToggle, { value: '', disabled: true, onValueChange: vi.fn() });
		await expect.element(screen.getByLabelText('Asistió', { exact: true })).toBeDisabled();
		await expect.element(screen.getByLabelText('Falta', { exact: true })).toBeDisabled();
	});
});

describe('selector de alumnos full pass', () => {
	it.each(['vacío', 'excluidos', 'deshabilitado'])('bloquea el selector cuando está %s', async (reason) => {
		const screen = await render(FullPassStudentPicker, {
			students: reason === 'vacío' ? [] : [fullPassStudent], excludedStudentIds: new Set(reason === 'excluidos' ? [2] : []), disabled: reason === 'deshabilitado', onSelect: vi.fn()
		});
		await expect.element(screen.getByRole('button', { name: 'Agregar full pass' })).toBeDisabled();
	});
	it.each(['  LUIS  ', '551234', '+52 55 12 34 56 78'])('busca por nombre o teléfono: %s', async (query) => {
		const onSelect = vi.fn();
		const screen = await render(FullPassStudentPicker, { students: [fullPassStudent], onSelect });
		await screen.getByRole('button', { name: 'Agregar full pass' }).click();
		await screen.getByRole('textbox', { name: 'Buscar alumno full pass' }).fill(query);
		await screen.getByRole('button', { name: /Luis López/ }).click();
		expect(onSelect).toHaveBeenCalledExactlyOnceWith(fullPassStudent);
		await expect.element(screen.getByRole('textbox', { name: 'Buscar alumno full pass' })).not.toBeInTheDocument();
	});
	it('muestra búsquedas sin coincidencias y nunca ofrece alumnos excluidos', async () => {
		const screen = await render(FullPassStudentPicker, { students: [fullPassStudent, { ...fullPassStudent, studentId: 3, fullName: 'Ana', phone: null }], excludedStudentIds: new Set([2]), onSelect: vi.fn() });
		await screen.getByRole('button', { name: 'Agregar full pass' }).click();
		await expect.element(screen.getByRole('button', { name: /Luis López/ })).not.toBeInTheDocument();
		await screen.getByRole('textbox', { name: 'Buscar alumno full pass' }).fill('sin coincidencia');
		await expect.element(screen.getByText('No se encontraron alumnos.', { exact: true })).toBeVisible();
	});
});

const dropInProps = { open: true, groupId: 10, sessionDate: '2026-10-16', students: [student], dropInPlans: [dropInPlan], paymentMethods: ['Efectivo' as const] };
describe('diálogo de pago por clase', () => {
	it('informa que faltan planes e impide enviar', async () => {
		const screen = await render(DropInQuickRegisterDialog, { ...dropInProps, dropInPlans: [] });
		await expect.element(screen.getByText(/No hay planes por clase/)).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Registrar pago', exact: true })).toBeDisabled();
	});
	it('exige un plan antes de enviar', async () => {
		const screen = await render(DropInQuickRegisterDialog, dropInProps);
		await screen.getByRole('button', { name: 'Registrar pago', exact: true }).click();
		expect(transport.post).not.toHaveBeenCalled();
	});
	it.each(['-1', '101', '0.5'])('rechaza descuento %s mediante restricciones HTML', async (discount) => {
		const screen = await render(DropInQuickRegisterDialog, dropInProps);
		await screen.getByRole('combobox', { name: 'Plan por clase', exact: true }).selectOptions('3');
		await screen.getByRole('spinbutton', { name: 'Descuento (%)', exact: true }).fill(discount);
		await screen.getByRole('button', { name: 'Registrar pago', exact: true }).click();
		expect(transport.post).not.toHaveBeenCalled();
	});
	it.each([false, true])('registra pago con alumno=%s y navega tras el éxito', async (withStudent) => {
		transport.post.mockResolvedValue({ type: 'redirect', status: 303, location: '/dashboard/clases/asistencia?saved=1' });
		const screen = await render(DropInQuickRegisterDialog, dropInProps);
		await screen.getByRole('combobox', { name: 'Plan por clase', exact: true }).selectOptions('3');
		if (withStudent) await screen.getByRole('combobox', { name: 'Alumno (opcional)', exact: true }).selectOptions('1');
		await screen.getByRole('spinbutton', { name: 'Descuento (%)', exact: true }).fill('100');
		await expect.element(screen.getByText('Descuento (100%)', { exact: true })).toBeVisible();
		await screen.getByRole('button', { name: withStudent ? 'Registrar pago y asistencia' : 'Registrar pago', exact: true }).click();
		await expect.poll(() => transport.goto.mock.calls.length).toBe(1);
		const [body, action] = transport.post.mock.calls[0];
		expect(action).toBe('?/registerDropIn');
		expect(body.get('studentId')).toBe(withStudent ? '1' : '');
		expect(body.get('groupId')).toBe('10');
		expect(body.get('sessionDate')).toBe('2026-10-16');
		expect(body.get('discountPercent')).toBe('100');
	});
	it('muestra errores de servidor y conserva el formulario tras el rechazo', async () => {
		const screen = await render(DropInQuickRegisterDialog, { ...dropInProps, message: 'No se pudo registrar.', errors: { dropInPlanId: 'Plan no disponible' } });
		await expect.element(screen.getByText('Plan no disponible', { exact: true })).toBeVisible();
		await expect.element(screen.getByText('No se pudo registrar.', { exact: true })).toBeVisible();
		await screen.getByRole('combobox', { name: 'Plan por clase', exact: true }).selectOptions('3');
		await screen.getByRole('button', { name: 'Registrar pago', exact: true }).click();
		await expect.poll(() => transport.update.mock.calls.length).toBe(1);
		await expect.element(screen.getByRole('dialog')).toBeVisible();
		expect(transport.goto).not.toHaveBeenCalled();
	});
});
