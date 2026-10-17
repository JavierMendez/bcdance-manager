import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ComponentProps } from 'svelte';
import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
import StudentsPage from '../../../../../src/routes/dashboard/alumnos/+page.svelte';
import StudentDialog from '$lib/components/students/student-dialog.svelte';
import type { SerializedStudent } from '$lib/students';
import type { PageData } from '../../../../../src/routes/dashboard/alumnos/$types';

const { post, update, showError } = vi.hoisted(() => ({
	post: vi.fn<(data: FormData, action: string) => Promise<ActionResult>>(),
	update: vi.fn(), showError: vi.fn()
}));
vi.mock('$lib/alerts.svelte.js', () => ({ showError, getActionErrorMessage: vi.fn() }));
// Sustituye solo el transporte de SvelteKit; conserva los formularios, validación HTML
// y callbacks reales de createDialogSubmitHandler y de la página.
vi.mock('$app/forms', () => ({
	enhance(form: HTMLFormElement, submit: SubmitFunction) {
		const handleSubmit = async (event: SubmitEvent) => {
			event.preventDefault();
			const formData = new FormData(form);
			const action = new URL(form.action);
			const callback = await submit({ formData, action, formElement: form, controller: new AbortController(), cancel() {}, submitter: event.submitter });
			const result = await post(formData, action.search);
			await callback?.({ result, update, formData, action, formElement: form });
		};
		form.addEventListener('submit', handleSubmit);
		return { destroy: () => form.removeEventListener('submit', handleSubmit) };
	}
}));

const ana: SerializedStudent = { id: 1, guid: 'student-1', fullName: 'Ana Pérez', phone: '5512345678', enrolledAt: '2026-10-16T12:00:00Z', active: true, paymentStatus: 'vigente' };
const luis: SerializedStudent = { ...ana, id: 2, guid: 'student-2', fullName: 'Luis López', phone: null, active: false, paymentStatus: 'vencido' };
const maria: SerializedStudent = { ...ana, id: 3, guid: 'student-3', fullName: 'María Torres', phone: '5587654321', paymentStatus: 'por_vencer' };
async function renderPage(students = [ana, luis, maria]) {
	return render(StudentsPage, { data: { students } as PageData, form: null });
}
async function renderDialog(props: Partial<ComponentProps<typeof StudentDialog>> = {}) {
	return render(StudentDialog, { open: true, mode: 'create', ...props });
}
beforeEach(() => {
	post.mockReset().mockResolvedValue({ type: 'failure', status: 400, data: {} });
	update.mockReset().mockResolvedValue(undefined);
	showError.mockReset();
});

describe('tabla y filtros de alumnos', () => {
	it('muestra alumnos activos e inactivos, tres estados de pago y teléfono opcional', async () => {
		const screen = await renderPage();
		await expect.element(screen.getByRole('heading', { name: 'Alumnos', exact: true })).toBeVisible();
		for (const name of [ana.fullName, luis.fullName, maria.fullName]) {
			await expect.element(screen.getByRole('cell', { name, exact: true })).toBeVisible();
		}
		for (const text of ['Vigente', 'Por vencer', 'Vencido', 'Inactivo', '—', '+52 55 12 34 56 78']) {
			await expect.element(screen.getByRole('cell', { name: text, exact: true })).toBeVisible();
		}
		expect(screen.getByRole('switch').elements().map((element) => element.getAttribute('aria-checked'))).toEqual(['true', 'false', 'true']);
	});

	it('muestra el estado inicial vacío y permite abrir el alta', async () => {
		const screen = await renderPage([]);
		await expect.element(screen.getByText('No hay alumnos registrados.')).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Editar', exact: true })).not.toBeInTheDocument();
		await screen.getByRole('button', { name: 'Nuevo alumno', exact: true }).click();
		await expect.element(screen.getByRole('dialog', { name: 'Nuevo alumno' })).toBeVisible();
	});

	it.each([
		['  aNA péREZ  ', 'Ana Pérez'], ['551234', 'Ana Pérez'],
		['+52 55 12 34 56 78', 'Ana Pérez'], ['55-87-65', 'María Torres']
	])('busca %j y encuentra únicamente %s', async (query, name) => {
		const screen = await renderPage();
		await screen.getByRole('textbox', { name: 'Buscar por nombre o teléfono' }).fill(query);
		await expect.element(screen.getByRole('cell', { name, exact: true })).toBeVisible();
		expect(screen.getByRole('button', { name: 'Editar', exact: true }).elements()).toHaveLength(1);
	});

	it('distingue una búsqueda sin resultados y recupera la tabla al limpiar', async () => {
		const screen = await renderPage();
		const search = screen.getByRole('textbox', { name: 'Buscar por nombre o teléfono' });
		await search.fill('desconocido');
		await expect.element(screen.getByText('No se encontraron alumnos.')).toBeVisible();
		await expect.element(screen.getByText('No hay alumnos registrados.')).not.toBeInTheDocument();
		await search.fill('   ');
		expect(screen.getByRole('button', { name: 'Editar', exact: true }).elements()).toHaveLength(3);
	});

	it.each([['active', 2], ['inactive', 1], ['all', 3]] as const)('filtra el estado %s', async (filter, count) => {
		const screen = await renderPage();
		await screen.getByRole('combobox', { name: 'Estado', exact: true }).selectOptions(filter);
		expect(screen.getByRole('button', { name: 'Editar', exact: true }).elements()).toHaveLength(count);
	});

	it.each([['vigente', 'Ana Pérez'], ['por_vencer', 'María Torres'], ['vencido', 'Luis López']])('filtra el pago %s', async (filter, name) => {
		const screen = await renderPage();
		await screen.getByRole('combobox', { name: 'Pago', exact: true }).selectOptions(filter);
		await expect.element(screen.getByRole('cell', { name, exact: true })).toBeVisible();
		expect(screen.getByRole('button', { name: 'Editar', exact: true }).elements()).toHaveLength(1);
	});

	it('combina filtros y conserva los contadores globales', async () => {
		const screen = await renderPage();
		await screen.getByRole('combobox', { name: 'Estado', exact: true }).selectOptions('active');
		await screen.getByRole('combobox', { name: 'Pago', exact: true }).selectOptions('vencido');
		await expect.element(screen.getByText('No se encontraron alumnos.')).toBeVisible();
		const cards = screen.container.querySelectorAll('[data-slot="card"]');
		expect(Array.from(cards, (card) => card.querySelector('[data-slot="card-title"]')?.textContent?.trim())).toEqual(['3', '2', '1']);
		await screen.getByRole('combobox', { name: 'Pago', exact: true }).selectOptions('por_vencer');
		await screen.getByRole('textbox', { name: 'Buscar por nombre o teléfono' }).fill('María');
		await expect.element(screen.getByRole('cell', { name: 'María Torres', exact: true })).toBeVisible();
	});

	it('escapa el contenido de los nombres', async () => {
		const fullName = '<img src=x onerror=alert(1)>';
		const screen = await renderPage([{ ...ana, fullName }]);
		await expect.element(screen.getByRole('cell', { name: fullName, exact: true })).toBeVisible();
		expect(screen.container.querySelector('img')).toBeNull();
	});
});

describe('alta y edición de alumnos', () => {
	it('abre la edición del alumno seleccionado con sus datos y su identificador', async () => {
		const screen = await renderPage([ana]);
		await screen.getByRole('button', { name: 'Editar', exact: true }).click();
		await expect.element(screen.getByRole('dialog', { name: 'Editar alumno' })).toBeVisible();
		await expect.element(screen.getByRole('textbox', { name: 'Nombre completo' })).toHaveValue('Ana Pérez');
		await expect.element(screen.getByLabelText('Teléfono', { exact: true })).toHaveValue('+52 55 12 34 56 78');
		await expect.element(screen.getByLabelText('Fecha de inscripción', { exact: true })).toHaveValue('2026-10-16');
		expect(document.querySelector<HTMLInputElement>('input[name="id"]')?.value).toBe('1');
	});

	it('cancela sin enviar y reinicia los campos al volver a abrir', async () => {
		const screen = await renderPage([]);
		await screen.getByRole('button', { name: 'Nuevo alumno', exact: true }).click();
		await screen.getByRole('textbox', { name: 'Nombre completo' }).fill('Borrador');
		await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		await screen.getByRole('button', { name: 'Nuevo alumno', exact: true }).click();
		await expect.element(screen.getByRole('textbox', { name: 'Nombre completo' })).toHaveValue('');
		expect(post).not.toHaveBeenCalled();
	});

	it.each(['nombre', 'fecha'])('impide enviar sin %s mediante validación HTML', async (missing) => {
		const screen = await renderDialog();
		if (missing === 'fecha') {
			await screen.getByRole('textbox', { name: 'Nombre completo' }).fill('Ana');
			await screen.getByLabelText('Fecha de inscripción', { exact: true }).fill('');
		}
		await screen.getByRole('button', { name: 'Crear alumno', exact: true }).click();
		expect(post).not.toHaveBeenCalled();
		await expect.element(screen.getByRole('dialog')).toBeVisible();
	});

	it('muestra errores por campo, valores previos y atributos de accesibilidad', async () => {
		const screen = await renderDialog({ errors: { fullName: 'Nombre obligatorio', phone: 'Teléfono incompleto', enrolledAt: 'Fecha obligatoria' }, values: { fullName: 'Ana', phone: '55', enrolledAt: '' } });
		for (const text of ['Nombre obligatorio', 'Teléfono incompleto', 'Fecha obligatoria']) {
			await expect.element(screen.getByText(text, { exact: true })).toBeVisible();
		}
		for (const label of ['Nombre completo', 'Teléfono', 'Fecha de inscripción']) {
			await expect.element(screen.getByLabelText(label, { exact: true })).toHaveAttribute('aria-invalid', 'true');
		}
		await expect.element(screen.getByRole('textbox', { name: 'Nombre completo' })).toHaveValue('Ana');
	});

	it.each(['create', 'edit'] as const)('envía el formulario %s y actualiza la tabla sin duplicar alumnos', async (mode) => {
		const saved = { ...ana, fullName: 'Ana actualizada' };
		post.mockResolvedValue({ type: 'success', status: 200, data: { success: true, student: saved } });
		const screen = await renderPage(mode === 'create' ? [] : [ana]);
		await screen.getByRole('button', { name: mode === 'create' ? 'Nuevo alumno' : 'Editar', exact: true }).click();
		await screen.getByRole('textbox', { name: 'Nombre completo' }).fill(saved.fullName);
		const phone = screen.getByLabelText('Teléfono', { exact: true });
		await phone.click();
		await phone.fill('+52 55 12 34 56 78');
		await screen.getByRole('button', { name: mode === 'create' ? 'Crear alumno' : 'Guardar cambios', exact: true }).click();
		await expect.element(screen.getByRole('cell', { name: saved.fullName, exact: true })).toBeVisible();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Editar', exact: true }).elements()).toHaveLength(1);
		const [formData, action] = post.mock.calls[0];
		expect(action).toBe(mode === 'create' ? '?/create' : '?/update');
		expect(formData.get('fullName')).toBe(saved.fullName);
		expect(formData.get('phone')).toBe('5512345678');
		expect(formData.get('id')).toBe(mode === 'create' ? null : '1');
	});

	it('bloquea los botones mientras guarda y permite reintentar tras un fallo', async () => {
		let resolve!: (result: ActionResult) => void;
		post.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
		const screen = await renderDialog({ values: { fullName: 'Ana', phone: '', enrolledAt: '2026-10-16' } });
		await screen.getByRole('button', { name: 'Crear alumno', exact: true }).click();
		await expect.element(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled();
		await expect.element(screen.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
		resolve({ type: 'failure', status: 500, data: { message: 'No se pudo guardar.' } });
		await expect.element(screen.getByRole('button', { name: 'Crear alumno', exact: true })).toBeEnabled();
		await expect.element(screen.getByRole('dialog')).toBeVisible();
		expect(showError).toHaveBeenCalledWith('No se pudo guardar.');
		await screen.getByRole('button', { name: 'Crear alumno', exact: true }).click();
		await expect.poll(() => post.mock.calls.length).toBe(2);
	});
});

describe('activación de alumnos', () => {
	it.each([true, false])('envía el cambio desde activo=%s y refleja la respuesta', async (active) => {
		const current = { ...ana, active };
		post.mockResolvedValue({ type: 'success', status: 200, data: { student: { ...current, active: !active } } });
		const screen = await renderPage([current]);
		await screen.getByRole('switch').click();
		await expect.element(screen.getByRole('switch')).toHaveAttribute('aria-checked', String(!active));
		const [formData, action] = post.mock.calls[0];
		expect(action).toBe('?/toggleActive');
		expect(formData.get('id')).toBe('1');
		expect(formData.get('active')).toBe(String(!active));
	});

	it('conserva el estado de la tabla cuando el servidor rechaza el cambio', async () => {
		const screen = await renderPage([ana]);
		await screen.getByRole('switch').click();
		await expect.poll(() => update.mock.calls.length).toBe(1);
		await expect.element(screen.getByRole('cell', { name: 'Activo', exact: true })).toBeVisible();
	});
});
