import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ComponentProps } from 'svelte';
import ClassesPage from '../../../../../src/routes/dashboard/clases/+page.svelte';
import DetailPage from '../../../../../src/routes/dashboard/clases/[groupId]/+page.svelte';
import { classGroup, programs } from '../../../../helpers/classes';
import { transport } from '../../../../helpers/forms';

vi.mock('$app/forms', () => import('../../../../helpers/forms'));
vi.mock('$lib/alerts.svelte.js', async () => ({ showError: (await import('../../../../helpers/forms')).transport.showError, getActionErrorMessage: () => null }));

type ListData = ComponentProps<typeof ClassesPage>['data'];
type DetailData = ComponentProps<typeof DetailPage>['data'];
const listData = (groups = [classGroup]) => ({ groups, programs, activeClassCount: groups.filter((g) => g.active).length, enrolledStudentCount: 0, fullPassStudentCount: 0 }) as ListData;
const detailData = (group = classGroup) => ({ classGroup: group, programs }) as DetailData;

describe('listado de clases', () => {
	it('muestra el estado vacío y abre el asistente para crear', async () => {
		const screen = await render(ClassesPage, { data: listData([]), form: null });
		await expect.element(screen.getByText('Aún no tienes clases. Crea la primera.', { exact: true })).toBeVisible();
		await screen.getByRole('button', { name: 'Nueva clase', exact: true }).first().click();
		await expect.element(screen.getByRole('dialog', { name: 'Nueva clase' })).toBeVisible();
	});
	it.each([0, 1, 2])('muestra contadores y plurales de %s inscritos', async (count) => {
		const screen = await render(ClassesPage, { data: listData([{ ...classGroup, enrolledCount: count, dropInCount: count, fullPassCount: count }]), form: null });
		await expect.element(screen.getByText(`${count} mensual${count === 1 ? '' : 'es'}`, { exact: true })).toBeVisible();
		await expect.element(screen.getByText(`${count} clase${count === 1 ? '' : 's'} suelta${count === 1 ? '' : 's'}`, { exact: true })).toBeVisible();
		await expect.element(screen.getByRole('link', { name: 'Ver detalle de Salsa' })).toHaveAttribute('href', '/dashboard/clases/10');
	});
	it('separa clases activas e inactivas y no ofrece asistencia para la inactiva', async () => {
		const screen = await render(ClassesPage, { data: listData([classGroup, { ...classGroup, id: 11, name: 'Bachata', active: false, isActive: false }]), form: null });
		await expect.element(screen.getByRole('heading', { name: 'Clases activas' })).toBeVisible();
		await expect.element(screen.getByRole('heading', { name: 'Clases inactivas' })).toBeVisible();
		const links = screen.getByRole('link', { name: 'Registrar asistencia', exact: true }).elements();
		expect(links.map((link) => link.getAttribute('href'))).toEqual(['/dashboard/clases/asistencia', '/dashboard/clases/asistencia?groupId=10']);
	});
	it('inserta la clase creada en el listado', async () => {
		transport.post.mockResolvedValue({ type: 'success', status: 200, data: { classGroup } });
		const screen = await render(ClassesPage, { data: listData([]), form: null });
		await screen.getByRole('button', { name: 'Nueva clase', exact: true }).first().click();
		await screen.getByRole('combobox', { name: 'Programa', exact: true }).selectOptions('1');
		await screen.getByRole('button', { name: 'Siguiente' }).click();
		await screen.getByRole('textbox', { name: 'Horario' }).fill('18:00');
		await screen.getByRole('checkbox', { name: 'Viernes', exact: true }).click();
		await screen.getByRole('button', { name: 'Crear clase', exact: true }).click();
		await expect.element(screen.getByRole('link', { name: 'Ver detalle de Salsa' })).toBeVisible();
		await expect.element(screen.getByText('Aún no tienes clases. Crea la primera.')).not.toBeInTheDocument();
	});
});

describe('detalle de clase y todas sus pestañas', () => {
	it.each([true, false])('presenta resumen con estado activo=%s y enlaces del grupo', async (active) => {
		const screen = await render(DetailPage, { data: detailData({ ...classGroup, active }), form: null });
		await expect.element(screen.getByRole('heading', { name: 'Salsa', exact: true })).toBeVisible();
		await expect.element(screen.getByText(active ? 'Activa' : 'Inactiva', { exact: true })).toBeVisible();
		await expect.element(screen.getByRole('link', { name: 'Inscribir alumno' })).toHaveAttribute('href', '/dashboard/clases/10/inscribir');
		await expect.element(screen.getByRole('link', { name: 'Registrar asistencia', exact: true })).toHaveAttribute('href', '/dashboard/clases/asistencia?groupId=10');
	});
	it('muestra alumnos y pagos vacíos sin perder la navegación', async () => {
		const screen = await render(DetailPage, { data: detailData(), form: null });
		await screen.getByRole('button', { name: 'Alumnos', exact: true }).click();
		await expect.element(screen.getByText('No hay alumnos inscritos en esta clase.')).toBeVisible();
		await screen.getByRole('button', { name: 'Pagos', exact: true }).click();
		await expect.element(screen.getByText('No hay pagos por clase registrados.')).toBeVisible();
		await expect.element(screen.getByRole('link', { name: 'Registrar pago', exact: true })).toHaveAttribute('href', '/dashboard/pagos/registrar?groupId=10');
		await screen.getByRole('button', { name: 'Asistencia', exact: true }).click();
		await expect.element(screen.getByRole('link', { name: 'Registrar asistencia de hoy' })).toHaveAttribute('href', '/dashboard/clases/asistencia?groupId=10');
	});
	it('muestra contacto ausente, estado de pago e ingresos de la clase', async () => {
		const group = { ...classGroup,
			members: [{ studentId: 1, fullName: 'Ana', phone: null, studentActive: true, modalityLabel: 'Mensual', planName: 'Plan salsa', coverageLabel: 'Vigente', paymentStatus: 'por_vencer' as const }],
			dropInPayments: [{ paymentId: 1, studentName: 'Sin alumno', planName: 'Suelta', totalAmount: 100, paymentMethod: 'Efectivo', paidAtLabel: '16 oct 2026' }] };
		const screen = await render(DetailPage, { data: detailData(group), form: null });
		await screen.getByRole('button', { name: 'Alumnos', exact: true }).click();
		await expect.element(screen.getByRole('cell', { name: 'Ana', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: '—', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: 'Por vencer', exact: true })).toBeVisible();
		await screen.getByRole('button', { name: 'Pagos', exact: true }).click();
		await expect.element(screen.getByRole('cell', { name: 'Sin alumno', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: 'Efectivo', exact: true })).toBeVisible();
	});
	it('guarda la configuración y refleja el nuevo estado en el resumen', async () => {
		transport.post.mockResolvedValue({ type: 'success', status: 200, data: { classGroup: { ...classGroup, active: false, isActive: false } } });
		const screen = await render(DetailPage, { data: detailData(), form: null });
		await screen.getByRole('button', { name: 'Configuraciones', exact: true }).click();
		await screen.getByRole('switch', { name: 'Clase activa' }).click();
		await screen.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
		await expect.poll(() => transport.update.mock.calls.length).toBe(1);
		await screen.getByRole('button', { name: 'Resumen', exact: true }).click();
		await expect.element(screen.getByText('Inactiva', { exact: true })).toBeVisible();
	});
	it('abre la configuración automáticamente tras un error del servidor', async () => {
		const screen = await render(DetailPage, { data: detailData(), form: { mode: 'updateClass', errors: { schedule: 'Horario obligatorio' }, values: { programId: '1', schedule: '', days: ['Viernes'], startDate: '', endDate: '', isActive: 'true' } } });
		await expect.element(screen.getByText('Horario obligatorio', { exact: true })).toBeVisible();
		await expect.element(screen.getByRole('textbox', { name: 'Horario' })).toHaveValue('');
	});
});
