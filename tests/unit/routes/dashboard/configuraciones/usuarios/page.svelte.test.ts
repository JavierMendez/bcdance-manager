import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import UsersPage from '../../../../../../src/routes/dashboard/configuraciones/usuarios/+page.svelte';
import { admin, regularUser, administrator, deferred, type ListResult } from '../../../../../helpers/users';

vi.mock('$lib/auth-client.js', async () => ({ authClient: { admin: (await import('../../../../../helpers/users')).admin } }));

describe('listado de usuarios', () => {
	it('muestra carga pendiente y consulta como máximo cien cuentas por fecha descendente', async () => {
		const pending = deferred<ListResult>(); admin.listUsers.mockReturnValueOnce(pending.promise);
		const screen = await render(UsersPage);
		await expect.element(screen.getByText('Cargando usuarios...')).toBeVisible();
		expect(admin.listUsers).toHaveBeenCalledExactlyOnceWith({ query: { limit: 100, sortBy: 'createdAt', sortDirection: 'desc' } });
		pending.resolve({ data: { users: [regularUser] }, error: null });
		await expect.element(screen.getByText(regularUser.email)).toBeVisible();
		await expect.element(screen.getByText('Cargando usuarios...')).not.toBeInTheDocument();
	});
	it('muestra nombre, email, roles, estados y acciones por cuenta', async () => {
		admin.listUsers.mockResolvedValue({ data: { users: [regularUser, { ...administrator, banned: true }] }, error: null });
		const screen = await render(UsersPage);
		const normal = screen.getByRole('row').filter({ hasText: regularUser.email });
		const suspended = screen.getByRole('row').filter({ hasText: administrator.email });
		await expect.element(normal.getByText('Usuario', { exact: true })).toBeVisible();
		await expect.element(normal.getByText('Activo', { exact: true })).toBeVisible();
		await expect.element(normal.getByRole('button', { name: 'Hacer admin' })).toBeVisible();
		await expect.element(suspended.getByText('Administrador', { exact: true })).toBeVisible();
		await expect.element(suspended.getByText('Suspendido', { exact: true })).toBeVisible();
		await expect.element(suspended.getByRole('button', { name: 'Reactivar' })).toBeVisible();
		await expect.element(suspended.getByRole('button', { name: 'Hacer usuario' })).toBeVisible();
	});
	it.each([null, {}, { users: [] }])('muestra el estado vacío para data=%j', async (data) => {
		admin.listUsers.mockResolvedValue({ data, error: null });
		const screen = await render(UsersPage);
		await expect.element(screen.getByText('No hay usuarios registrados.')).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Nuevo usuario' })).toBeEnabled();
		await expect.element(screen.getByRole('button', { name: 'Editar', exact: true })).not.toBeInTheDocument();
	});
	it.each([
		[{ message: 'Acceso denegado' }, 'Acceso denegado'],
		[{}, 'No se pudieron cargar los usuarios.']
	] as const)('muestra errores de listado: %j', async (error, message) => {
		admin.listUsers.mockResolvedValue({ data: { users: [regularUser] }, error });
		const screen = await render(UsersPage);
		await expect.element(screen.getByText(message)).toBeVisible();
		await expect.element(screen.getByText(regularUser.email)).not.toBeInTheDocument();
		await expect.element(screen.getByText('No hay usuarios registrados.')).not.toBeInTheDocument();
	});
	it.each([null, undefined, 'desconocido'])('interpreta rol %j y estado ausente como usuario activo', async (role) => {
		admin.listUsers.mockResolvedValue({ data: { users: [{ ...regularUser, role, banned: null }] }, error: null });
		const screen = await render(UsersPage);
		await expect.element(screen.getByText('Usuario', { exact: true })).toBeVisible();
		await expect.element(screen.getByText('Activo', { exact: true })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Suspender' })).toBeVisible();
	});
	it('escapa HTML y conserva nombres Unicode largos y repetidos por IDs distintos', async () => {
		const name = '<img src=x onerror=alert(1)> José 🩰 ' + 'Á'.repeat(200);
		admin.listUsers.mockResolvedValue({ data: { users: [{ ...regularUser, name }, { ...administrator, name }] }, error: null });
		const screen = await render(UsersPage);
		await expect.element(screen.getByText(name, { exact: true }).first()).toBeVisible();
		expect(screen.getByRole('row').elements()).toHaveLength(3);
		expect(document.querySelector('table img')).toBeNull();
	});
});
