import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ActionResult } from '@sveltejs/kit';
import ClassCreationWizard from '$lib/components/classes/class-creation-wizard.svelte';
import ClassSettingsForm from '$lib/components/classes/class-settings-form.svelte';
import { classGroup, programs } from '../../../../helpers/classes';
import { transport } from '../../../../helpers/forms';

vi.mock('$app/forms', () => import('../../../../helpers/forms'));
vi.mock('$lib/alerts.svelte.js', async () => {
	const { transport } = await import('../../../../helpers/forms');
	return { showError: transport.showError, getActionErrorMessage: (data: { message?: string }) => data?.message };
});

describe('asistente de creación de clase', () => {
	it('impide avanzar sin programa y permite cancelar sin enviar', async () => {
		const onClosed = vi.fn();
		const screen = await render(ClassCreationWizard, { open: true, programs, onClosed });
		await expect.element(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
		await screen.getByRole('button', { name: 'Cancelar' }).click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(onClosed).toHaveBeenCalledOnce();
		expect(transport.post).not.toHaveBeenCalled();
	});

	it('exige nombre y descripción para un programa nuevo, incluso con espacios', async () => {
		const screen = await render(ClassCreationWizard, { open: true, programs: [] });
		await screen.getByRole('combobox', { name: 'Programa', exact: true }).selectOptions('__new__');
		await screen.getByRole('textbox', { name: 'Nombre del programa' }).fill('   ');
		await expect.element(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
		await screen.getByRole('textbox', { name: 'Nombre del programa' }).fill('Bachata');
		await screen.getByRole('textbox', { name: 'Descripción', exact: true }).fill('Nivel inicial');
		await screen.getByRole('button', { name: 'Siguiente' }).click();
		await expect.element(screen.getByRole('textbox', { name: 'Horario' })).toBeVisible();
		await screen.getByRole('button', { name: 'Atrás', exact: true }).click();
		await expect.element(screen.getByRole('textbox', { name: 'Nombre del programa' })).toHaveValue('Bachata');
	});

	it.each(['existing', 'new'] as const)('crea con programa %s, múltiples días y estado inactivo', async (mode) => {
		const onSuccess = vi.fn();
		transport.post.mockResolvedValue({ type: 'success', status: 200, data: { classGroup } });
		const screen = await render(ClassCreationWizard, { open: true, programs, onSuccess });
		await screen.getByRole('combobox', { name: 'Programa', exact: true }).selectOptions(mode === 'new' ? '__new__' : '1');
		if (mode === 'new') {
			await screen.getByRole('textbox', { name: 'Nombre del programa' }).fill('Bachata');
			await screen.getByRole('textbox', { name: 'Descripción', exact: true }).fill('Nivel inicial');
		}
		await screen.getByRole('button', { name: 'Siguiente' }).click();
		await screen.getByRole('textbox', { name: 'Horario' }).fill('18:00 - 19:00');
		await screen.getByRole('checkbox', { name: 'Lunes', exact: true }).click();
		await screen.getByRole('checkbox', { name: 'Viernes', exact: true }).click();
		await screen.getByRole('switch', { name: 'Clase activa' }).click();
		await screen.getByRole('button', { name: 'Crear clase', exact: true }).click();
		await expect.poll(() => onSuccess.mock.calls.length).toBe(1);
		const [body, action] = transport.post.mock.calls[0];
		expect(action).toBe('?/createClass');
		expect(body.getAll('days')).toEqual(['Lunes', 'Viernes']);
		expect(body.get('isActive')).toBe('false');
		expect(body.get('programId')).toBe(mode === 'new' ? '' : '1');
		if (mode === 'new') expect(body.get('newProgramName')).toBe('Bachata');
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('requiere horario antes de enviar y muestra los errores y valores del servidor', async () => {
		const screen = await render(ClassCreationWizard, { open: true, programs,
			values: { programId: '1', days: ['Lunes', 'Viernes'] }, errors: { days: 'Revisa los días', schedule: 'Horario requerido' } });
		await expect.element(screen.getByRole('checkbox', { name: 'Lunes', exact: true })).toBeChecked();
		await expect.element(screen.getByText('Revisa los días', { exact: true })).toBeVisible();
		await screen.getByRole('button', { name: 'Crear clase', exact: true }).click();
		expect(transport.post).not.toHaveBeenCalled();
	});

	it('bloquea ambos botones durante el guardado y conserva el diálogo tras un fallo', async () => {
		let resolve!: (result: ActionResult) => void;
		transport.post.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
		const screen = await render(ClassCreationWizard, { open: true, programs, values: { programId: '1', schedule: '18:00', days: 'Viernes' } });
		await screen.getByRole('button', { name: 'Crear clase', exact: true }).click();
		await expect.element(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled();
		await expect.element(screen.getByRole('button', { name: 'Atrás', exact: true })).toBeDisabled();
		resolve({ type: 'failure', status: 400, data: { message: 'No se pudo crear.' } });
		await expect.element(screen.getByRole('button', { name: 'Crear clase', exact: true })).toBeEnabled();
		expect(transport.showError).toHaveBeenCalledWith('No se pudo crear.');
	});
});

describe('configuración de clase', () => {
	it('precarga programa, horario, días y estado', async () => {
		const screen = await render(ClassSettingsForm, { classGroup, programs });
		await expect.element(screen.getByRole('combobox', { name: 'Programa', exact: true })).toHaveValue('1');
		await expect.element(screen.getByRole('textbox', { name: 'Horario' })).toHaveValue(classGroup.schedule);
		await expect.element(screen.getByRole('checkbox', { name: 'Viernes', exact: true })).toBeChecked();
		await expect.element(screen.getByRole('switch', { name: 'Clase activa' })).toBeChecked();
	});

	it('envía cambios de días, programa y fechas opcionales y llama onSuccess', async () => {
		const onSuccess = vi.fn();
		transport.post.mockResolvedValue({ type: 'success', status: 200, data: { classGroup } });
		const screen = await render(ClassSettingsForm, { classGroup, programs, onSuccess });
		await screen.getByRole('checkbox', { name: 'Viernes', exact: true }).click();
		await screen.getByRole('checkbox', { name: 'Lunes', exact: true }).click();
		await screen.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
		await expect.poll(() => onSuccess.mock.calls.length).toBe(1);
		const [body, action] = transport.post.mock.calls[0];
		expect(action).toBe('?/updateClass');
		expect(body.getAll('days')).toEqual(['Lunes']);
		expect(body.get('startDate')).toBe('');
		expect(transport.update).toHaveBeenCalledWith({ reset: false, invalidateAll: true });
	});

	it('no envía un horario vacío', async () => {
		const screen = await render(ClassSettingsForm, { classGroup, programs });
		await screen.getByRole('textbox', { name: 'Horario' }).fill('');
		await screen.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
		expect(transport.post).not.toHaveBeenCalled();
	});

	it('restaura valores rechazados, muestra errores y permite reintentar', async () => {
		const screen = await render(ClassSettingsForm, { classGroup, programs,
			values: { programId: '1', schedule: '20:00', days: [], startDate: '', endDate: '', isActive: 'false' },
			errors: { days: 'Selecciona al menos un día.' } });
		await expect.element(screen.getByRole('textbox', { name: 'Horario' })).toHaveValue('20:00');
		await expect.element(screen.getByRole('switch', { name: 'Clase activa' })).not.toBeChecked();
		await expect.element(screen.getByText('Selecciona al menos un día.', { exact: true })).toBeVisible();
		await screen.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
		await expect.poll(() => transport.update.mock.calls.length).toBe(1);
		await expect.element(screen.getByRole('button', { name: 'Guardar cambios', exact: true })).toBeEnabled();
	});
});
