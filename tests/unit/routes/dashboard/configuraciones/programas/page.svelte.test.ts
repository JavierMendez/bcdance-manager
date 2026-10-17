import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ComponentProps } from 'svelte';
import ProgramsPage from '../../../../../../src/routes/dashboard/configuraciones/programas/+page.svelte';
import type { SerializedProgramWithUsage } from '$lib/programs';
import { authData } from '../../../../../helpers/payments';
import { transport } from '../../../../../helpers/forms';

vi.mock('$app/forms', () => import('../../../../../helpers/forms'));
vi.mock('$lib/alerts.svelte.js', async () => ({ showError: (await import('../../../../../helpers/forms')).transport.showError, getActionErrorMessage: () => null }));
const first = { id: 1, name: 'Salsa', description: 'Nivel inicial', classCount: 3 };
const second = { id: 2, name: 'Bachata', description: 'Nivel intermedio', classCount: 0 };
type Data = ComponentProps<typeof ProgramsPage>['data'];
const dataWith = (programs: SerializedProgramWithUsage[] = [first, second]): Data => ({ ...authData, programs });

describe('tabla de programas', () => {
	it('muestra el estado vacío e indica que el alta se realiza desde clases', async () => {
		const screen = await render(ProgramsPage, { data: dataWith([]), form: null });
		await expect.element(screen.getByRole('heading', { name: 'Programas', exact: true })).toBeVisible();
		await expect.element(screen.getByText('No hay programas registrados. Crea tu primera clase para registrar un programa.', { exact: true })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Editar', exact: true })).not.toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: /Crear|Nuevo|Eliminar/ })).not.toBeInTheDocument();
	});
	it.each([0, 1, 2])('muestra uso de %s clases con la pluralización correcta', async (classCount) => {
		const screen = await render(ProgramsPage, { data: dataWith([{ ...first, classCount }]), form: null });
		await expect.element(screen.getByRole('cell', { name: 'Salsa', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: 'Nivel inicial', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: `${classCount} clase${classCount === 1 ? '' : 's'}`, exact: true })).toBeVisible();
	});
	it('escapa nombre y descripción y conserva textos largos en la celda', async () => {
		const name = '<img src=x onerror=alert(1)>';
		const description = `Descripción extensa ${'á'.repeat(300)}`;
		const screen = await render(ProgramsPage, { data: dataWith([{ ...first, name, description }]), form: null });
		await expect.element(screen.getByRole('cell', { name, exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: description, exact: true })).toBeVisible();
		expect(screen.container.querySelector('img')).toBeNull();
	});
});

describe('edición desde la tabla de programas', () => {
	it('abre el programa seleccionado y envía su ID', async () => {
		const screen = await render(ProgramsPage, { data: dataWith(), form: null });
		await screen.getByRole('button', { name: 'Editar', exact: true }).nth(1).click();
		await expect.element(screen.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue('Bachata');
		await screen.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
		await expect.poll(() => transport.post.mock.calls.length).toBe(1);
		expect(transport.post.mock.calls[0][0].get('id')).toBe('2');
	});
	it('actualiza solo el programa editado, conserva el conteo y evita duplicados', async () => {
		transport.post.mockResolvedValue({ type: 'success', status: 200, data: { program: { id: 1, name: 'Salsa avanzada', description: 'Nivel avanzado' } } });
		const screen = await render(ProgramsPage, { data: dataWith(), form: null });
		await screen.getByRole('button', { name: 'Editar', exact: true }).first().click();
		await screen.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Salsa avanzada');
		await screen.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		await expect.element(screen.getByRole('cell', { name: 'Salsa avanzada', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: 'Nivel avanzado', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: '3 clases', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: 'Bachata', exact: true })).toBeVisible();
		expect(screen.getByRole('button', { name: 'Editar', exact: true }).elements()).toHaveLength(2);
	});
	it('ignora respuestas de un programa ajeno al listado', async () => {
		transport.post.mockResolvedValue({ type: 'success', status: 200, data: { program: { id: 99, name: 'Ajeno', description: 'No corresponde' } } });
		const screen = await render(ProgramsPage, { data: dataWith(), form: null });
		await screen.getByRole('button', { name: 'Editar', exact: true }).first().click();
		await screen.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		await expect.element(screen.getByRole('cell', { name: 'Ajeno', exact: true })).not.toBeInTheDocument();
		await expect.element(screen.getByRole('cell', { name: 'Salsa', exact: true })).toBeVisible();
	});
	it('cancela un borrador y permite abrir otro programa sin reutilizar datos anteriores', async () => {
		const screen = await render(ProgramsPage, { data: dataWith(), form: null });
		await screen.getByRole('button', { name: 'Editar', exact: true }).first().click();
		await screen.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Borrador');
		await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		await screen.getByRole('button', { name: 'Editar', exact: true }).nth(1).click();
		await expect.element(screen.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue(second.name);
		await expect.element(screen.getByRole('textbox', { name: 'Descripción', exact: true })).toHaveValue(second.description);
		expect(transport.post).not.toHaveBeenCalled();
	});
	it('abre automáticamente la edición rechazada y restaura valores y errores', async () => {
		const screen = await render(ProgramsPage, { data: dataWith(), form: { mode: 'edit', id: 2, errors: { name: 'El nombre es obligatorio.' }, values: { name: '', description: 'Descripción corregida' } } });
		await expect.element(screen.getByRole('dialog', { name: 'Editar programa' })).toBeVisible();
		await expect.element(screen.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue('');
		await expect.element(screen.getByText('El nombre es obligatorio.', { exact: true })).toBeVisible();
		expect(document.querySelector<HTMLInputElement>('input[name="id"]')?.value).toBe('2');
	});
	it('no cambia el listado cuando falla el guardado', async () => {
		transport.post.mockResolvedValue({ type: 'failure', status: 404, data: { message: 'Programa no encontrado.' } });
		const screen = await render(ProgramsPage, { data: dataWith(), form: null });
		await screen.getByRole('button', { name: 'Editar', exact: true }).first().click();
		await screen.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Cambio rechazado');
		await screen.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
		await expect.poll(() => transport.update.mock.calls.length).toBe(1);
		await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
		await expect.element(screen.getByRole('cell', { name: 'Salsa', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('cell', { name: 'Cambio rechazado', exact: true })).not.toBeInTheDocument();
	});
});
