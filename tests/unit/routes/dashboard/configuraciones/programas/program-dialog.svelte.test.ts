import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ComponentProps } from 'svelte';
import type { ActionResult } from '@sveltejs/kit';
import ProgramDialog from '$lib/components/programs/program-dialog.svelte';
import { transport } from '../../../../../helpers/forms';

vi.mock('$app/forms', () => import('../../../../../helpers/forms'));
vi.mock('$lib/alerts.svelte.js', async () => ({
	showError: (await import('../../../../../helpers/forms')).transport.showError,
	getActionErrorMessage: () => null
}));
const program = { id: 1, name: 'Salsa', description: 'Nivel inicial' };
const renderDialog = (props: Partial<ComponentProps<typeof ProgramDialog>> = {}) => render(ProgramDialog, { open: true, mode: 'edit', program, ...props });

describe('diálogo de programa', () => {
	it('precarga campos requeridos y el identificador del programa', async () => {
		const screen = await renderDialog();
		await expect.element(screen.getByRole('dialog', { name: 'Editar programa' })).toBeVisible();
		await expect.element(screen.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue('Salsa');
		await expect.element(screen.getByRole('textbox', { name: 'Descripción', exact: true })).toHaveValue('Nivel inicial');
		await expect.element(screen.getByRole('textbox', { name: 'Nombre', exact: true })).toBeRequired();
		await expect.element(screen.getByRole('textbox', { name: 'Descripción', exact: true })).toBeRequired();
		expect(document.querySelector<HTMLInputElement>('input[name="id"]')?.value).toBe('1');
	});
	it('permanece oculto mientras está cerrado', async () => {
		const screen = await renderDialog({ open: false });
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(transport.post).not.toHaveBeenCalled();
	});
	it('muestra el modo create del componente sin identificador ni datos previos', async () => {
		const screen = await renderDialog({ mode: 'create', program: null });
		await expect.element(screen.getByRole('dialog', { name: 'Nuevo programa' })).toBeVisible();
		await expect.element(screen.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue('');
		await expect.element(screen.getByRole('button', { name: 'Crear programa', exact: true })).toBeVisible();
		expect(document.querySelector('input[name="id"]')).toBeNull();
		// La ruta de configuraciones solo expone edición; aquí se verifica únicamente
		// el contrato visual del modo create del componente compartido.
	});
	it('cancela sin guardar y llama al callback de cierre', async () => {
		const onClosed = vi.fn();
		const screen = await renderDialog({ onClosed });
		await screen.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Borrador');
		await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(onClosed).toHaveBeenCalledOnce();
		expect(transport.post).not.toHaveBeenCalled();
	});
	it.each(['Nombre', 'Descripción'])('impide enviar con %s vacío mediante validación HTML', async (label) => {
		const screen = await renderDialog();
		await screen.getByRole('textbox', { name: label, exact: true }).fill('');
		await screen.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
		expect(transport.post).not.toHaveBeenCalled();
		await expect.element(screen.getByRole('dialog')).toBeVisible();
	});
	it('conserva valores rechazados incluso vacíos y muestra errores accesibles', async () => {
		const screen = await renderDialog({ values: { name: '', description: 'Descripción rechazada' }, errors: { name: 'Nombre obligatorio', description: 'Revisa la descripción' } });
		await expect.element(screen.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue('');
		await expect.element(screen.getByRole('textbox', { name: 'Descripción', exact: true })).toHaveValue('Descripción rechazada');
		for (const label of ['Nombre', 'Descripción']) {
			await expect.element(screen.getByRole('textbox', { name: label, exact: true })).toHaveAttribute('aria-invalid', 'true');
		}
		await expect.element(screen.getByText('Nombre obligatorio', { exact: true })).toBeVisible();
		await expect.element(screen.getByText('Revisa la descripción', { exact: true })).toBeVisible();
	});
	it('envía campos y callbacks reales, cierra y actualiza tras el éxito', async () => {
		const saved = { ...program, name: 'Bachata', description: 'Nivel avanzado' };
		transport.post.mockResolvedValue({ type: 'success', status: 200, data: { success: true, program: saved } });
		const onSuccess = vi.fn(); const onClosed = vi.fn();
		const screen = await renderDialog({ onSuccess, onClosed });
		await screen.getByRole('textbox', { name: 'Nombre', exact: true }).fill(saved.name);
		await screen.getByRole('textbox', { name: 'Descripción', exact: true }).fill(saved.description);
		await screen.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
		await expect.poll(() => onSuccess.mock.calls.length).toBe(1);
		const [body, action] = transport.post.mock.calls[0];
		expect(action).toBe('?/update');
		expect(Object.fromEntries(body)).toEqual({ id: '1', name: saved.name, description: saved.description });
		expect(onSuccess).toHaveBeenCalledExactlyOnceWith({ success: true, program: saved });
		expect(onClosed).toHaveBeenCalledOnce();
		expect(transport.update).toHaveBeenCalledWith({ reset: false, invalidateAll: false });
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
	});
	it('bloquea los botones al guardar y permite reintentar tras el rechazo', async () => {
		let resolve!: (result: ActionResult) => void;
		transport.post.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
		const onSuccess = vi.fn();
		const screen = await renderDialog({ onSuccess });
		await screen.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
		await expect.element(screen.getByRole('button', { name: 'Guardando...', exact: true })).toBeDisabled();
		await expect.element(screen.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
		resolve({ type: 'failure', status: 404, data: { message: 'Programa no encontrado.' } });
		await expect.element(screen.getByRole('button', { name: 'Guardar cambios', exact: true })).toBeEnabled();
		await expect.element(screen.getByRole('dialog')).toBeVisible();
		expect(transport.showError).toHaveBeenCalledWith('Programa no encontrado.');
		expect(onSuccess).not.toHaveBeenCalled();
		await screen.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
		await expect.poll(() => transport.post.mock.calls.length).toBe(2);
	});
});
