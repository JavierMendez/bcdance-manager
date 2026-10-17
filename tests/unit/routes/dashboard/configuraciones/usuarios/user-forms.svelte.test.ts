import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import UsersPage from '../../../../../../src/routes/dashboard/configuraciones/usuarios/+page.svelte';
import { admin, regularUser, administrator, deferred, type AuthResult } from '../../../../../helpers/users';

vi.mock('$lib/auth-client.js', async () => ({ authClient: { admin: (await import('../../../../../helpers/users')).admin } }));

async function openForm(mode: 'create' | 'edit') {
	const screen = await render(UsersPage);
	await expect.element(screen.getByText(regularUser.email)).toBeVisible();
	await screen.getByRole('button', { name: mode === 'create' ? 'Nuevo usuario' : 'Editar', exact: true }).click();
	return screen;
}
async function fillCreate(screen: Awaited<ReturnType<typeof openForm>>) {
	await screen.getByLabelText('Nombre', { exact: true }).fill('José 🩰');
	await screen.getByLabelText('Email', { exact: true }).fill('jose@example.com');
	await screen.getByLabelText('Contraseña', { exact: true }).fill('12345678');
}

describe('alta de cuentas', () => {
	it('exige nombre, email válido y contraseña oculta de al menos ocho caracteres; rol inicial usuario', async () => {
		const screen = await openForm('create');
		for (const label of ['Nombre', 'Email', 'Contraseña']) await expect.element(screen.getByLabelText(label, { exact: true })).toBeRequired();
		await expect.element(screen.getByLabelText('Email', { exact: true })).toHaveAttribute('type', 'email');
		await expect.element(screen.getByLabelText('Contraseña', { exact: true })).toHaveAttribute('type', 'password');
		await expect.element(screen.getByLabelText('Contraseña', { exact: true })).toHaveAttribute('minlength', '8');
		await expect.element(screen.getByLabelText('Rol', { exact: true })).toHaveValue('user');
	});
	it.each([
		{ field: 'Nombre', value: '' }, { field: 'Email', value: '' },
		{ field: 'Email', value: 'invalido' }, { field: 'Contraseña', value: '' },
		{ field: 'Contraseña', value: '1234567' }
	])('impide enviar $field=$value', async ({ field, value }) => {
		const screen = await openForm('create'); await fillCreate(screen);
		await screen.getByLabelText(field, { exact: true }).fill(value);
		await screen.getByRole('button', { name: 'Crear usuario', exact: true }).click();
		expect(admin.createUser).not.toHaveBeenCalled(); expect(admin.listUsers).toHaveBeenCalledTimes(1);
	});
	it.each(['user', 'admin'])('crea con rol %s y contraseña en el límite de ocho caracteres', async (role) => {
		const screen = await openForm('create'); await fillCreate(screen);
		await screen.getByLabelText('Rol', { exact: true }).selectOptions(role);
		admin.listUsers.mockResolvedValueOnce({ data: { users: [regularUser, { ...administrator, name: 'José 🩰', email: 'jose@example.com', role }] }, error: null });
		await screen.getByRole('button', { name: 'Crear usuario', exact: true }).click();
		await expect.element(screen.getByText('jose@example.com', { exact: true })).toBeVisible();
		expect(admin.createUser).toHaveBeenCalledExactlyOnceWith({ name: 'José 🩰', email: 'jose@example.com', password: '12345678', role });
		expect(admin.listUsers).toHaveBeenCalledTimes(2);
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
	});
	it.each([[{ message: 'Email ya registrado' }, 'Email ya registrado'], [{}, 'No se pudo crear el usuario.']] as const)('conserva datos y permite reintentar tras %j', async (error, message) => {
		admin.createUser.mockResolvedValueOnce({ error });
		const screen = await openForm('create'); await fillCreate(screen);
		await screen.getByRole('button', { name: 'Crear usuario', exact: true }).click();
		await expect.element(screen.getByRole('dialog').getByText(message, { exact: true })).toBeVisible();
		await expect.element(screen.getByLabelText('Email', { exact: true })).toHaveValue('jose@example.com');
		await expect.element(screen.getByLabelText('Contraseña', { exact: true })).toHaveValue('12345678');
		expect(admin.listUsers).toHaveBeenCalledTimes(1);
		await screen.getByRole('button', { name: 'Crear usuario', exact: true }).click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(admin.createUser).toHaveBeenCalledTimes(2);
		await expect.element(screen.getByText(message, { exact: true })).not.toBeInTheDocument();
	});
	it('cancela y limpia nombre, email, contraseña, rol y error al reabrir', async () => {
		admin.createUser.mockResolvedValueOnce({ error: { message: 'Error de alta' } });
		const screen = await openForm('create'); await fillCreate(screen);
		await screen.getByLabelText('Rol', { exact: true }).selectOptions('admin');
		await screen.getByRole('button', { name: 'Crear usuario', exact: true }).click();
		await expect.element(screen.getByRole('dialog').getByText('Error de alta')).toBeVisible();
		await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
		await screen.getByRole('button', { name: 'Nuevo usuario', exact: true }).click();
		for (const label of ['Nombre', 'Email', 'Contraseña']) await expect.element(screen.getByLabelText(label, { exact: true })).toHaveValue('');
		await expect.element(screen.getByLabelText('Rol', { exact: true })).toHaveValue('user');
		await expect.element(screen.getByText('Error de alta')).not.toBeInTheDocument();
		expect(admin.createUser).toHaveBeenCalledTimes(1);
	});
	it('muestra el error de recarga si el alta funcionó pero no se pudo recuperar el listado', async () => {
		const screen = await openForm('create'); await fillCreate(screen);
		admin.listUsers.mockResolvedValueOnce({ data: null, error: { message: 'Recarga fallida' } });
		await screen.getByRole('button', { name: 'Crear usuario', exact: true }).click();
		await expect.element(screen.getByText('Recarga fallida')).toBeVisible();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		await expect.element(screen.getByText('jose@example.com')).not.toBeInTheDocument();
	});
});

describe('edición de nombre', () => {
	it('precarga solo el nombre y envía el ID seleccionado con espacios recortados', async () => {
		const screen = await openForm('edit');
		await expect.element(screen.getByLabelText('Nombre', { exact: true })).toHaveValue(regularUser.name);
		await expect.element(screen.getByRole('dialog').getByText(`Actualiza el nombre de ${regularUser.email}.`)).toBeVisible();
		await expect.element(screen.getByLabelText('Email', { exact: true })).not.toBeInTheDocument();
		await expect.element(screen.getByLabelText('Contraseña', { exact: true })).not.toBeInTheDocument();
		await expect.element(screen.getByLabelText('Rol', { exact: true })).not.toBeInTheDocument();
		await screen.getByLabelText('Nombre', { exact: true }).fill('  Nuevo José 🩰  ');
		admin.listUsers.mockResolvedValueOnce({ data: { users: [{ ...regularUser, name: 'Nuevo José 🩰' }] }, error: null });
		await screen.getByRole('button', { name: 'Guardar cambios' }).click();
		await expect.element(screen.getByText('Nuevo José 🩰', { exact: true })).toBeVisible();
		expect(admin.updateUser).toHaveBeenCalledExactlyOnceWith({ userId: regularUser.id, data: { name: 'Nuevo José 🩰' } });
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
	});
	it('rechaza nombre vacío sin llamar al proveedor', async () => {
		const screen = await openForm('edit');
		await screen.getByLabelText('Nombre', { exact: true }).fill('');
		await screen.getByRole('button', { name: 'Guardar cambios' }).click();
		expect(admin.updateUser).not.toHaveBeenCalled();
	});
	it.each([[{ message: 'Actualización denegada' }, 'Actualización denegada'], [{}, 'No se pudo actualizar el nombre.']] as const)('conserva el nombre rechazado y reintenta: %j', async (error, message) => {
		admin.updateUser.mockResolvedValueOnce({ error });
		const screen = await openForm('edit');
		await screen.getByLabelText('Nombre', { exact: true }).fill('Nombre corregido');
		await screen.getByRole('button', { name: 'Guardar cambios' }).click();
		await expect.element(screen.getByRole('dialog').getByText(message, { exact: true })).toBeVisible();
		await expect.element(screen.getByLabelText('Nombre', { exact: true })).toHaveValue('Nombre corregido');
		expect(admin.listUsers).toHaveBeenCalledTimes(1);
		await screen.getByRole('button', { name: 'Guardar cambios' }).click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(admin.updateUser).toHaveBeenCalledTimes(2);
	});
	it('descarta cambios al cancelar y selecciona otra cuenta sin conservar el nombre anterior', async () => {
		admin.listUsers.mockResolvedValue({ data: { users: [regularUser, administrator] }, error: null });
		const screen = await render(UsersPage);
		await screen.getByRole('row').filter({ hasText: regularUser.email }).getByRole('button', { name: 'Editar', exact: true }).click();
		await screen.getByLabelText('Nombre', { exact: true }).fill('Cambio descartado');
		await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
		await screen.getByRole('row').filter({ hasText: administrator.email }).getByRole('button', { name: 'Editar', exact: true }).click();
		await expect.element(screen.getByLabelText('Nombre', { exact: true })).toHaveValue(administrator.name);
		await screen.getByRole('button', { name: 'Guardar cambios' }).click();
		await expect.poll(() => admin.updateUser.mock.calls).toEqual([[{ userId: administrator.id, data: { name: administrator.name } }]]);
	});
});

it.each(['create', 'edit'] as const)('bloquea los controles del formulario %s mientras espera al proveedor', async (mode) => {
	const pending = deferred<AuthResult>();
	(mode === 'create' ? admin.createUser : admin.updateUser).mockReturnValueOnce(pending.promise);
	const screen = await openForm(mode);
	if (mode === 'create') await fillCreate(screen);
	await screen.getByRole('button', { name: mode === 'create' ? 'Crear usuario' : 'Guardar cambios', exact: true }).click();
	for (const label of mode === 'create' ? ['Nombre', 'Email', 'Contraseña', 'Rol'] : ['Nombre']) await expect.element(screen.getByLabelText(label, { exact: true })).toBeDisabled();
	await expect.element(screen.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
	await expect.element(screen.getByRole('button', { name: mode === 'create' ? 'Creando...' : 'Guardando...', exact: true })).toBeDisabled();
	pending.resolve({ error: {} });
	await expect.element(screen.getByLabelText('Nombre', { exact: true })).toBeEnabled();
	await expect.element(screen.getByRole('button', { name: 'Cancelar', exact: true })).toBeEnabled();
});
