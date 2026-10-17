import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import UsersPage from '../../../../../../src/routes/dashboard/configuraciones/usuarios/+page.svelte';
import { admin, regularUser, administrator, deferred, type AuthResult } from '../../../../../helpers/users';

vi.mock('$lib/auth-client.js', async () => ({ authClient: { admin: (await import('../../../../../helpers/users')).admin } }));

const mutations = [
	{ method: 'setRole', label: 'Hacer admin', user: regularUser, args: { userId: regularUser.id, role: 'admin' }, updated: { ...regularUser, role: 'admin' }, result: 'Hacer usuario', fallback: 'No se pudo cambiar el rol.' },
	{ method: 'setRole', label: 'Hacer usuario', user: administrator, args: { userId: administrator.id, role: 'user' }, updated: { ...administrator, role: 'user' }, result: 'Hacer admin', fallback: 'No se pudo cambiar el rol.' },
	{ method: 'banUser', label: 'Suspender', user: regularUser, args: { userId: regularUser.id, banReason: 'Suspendido por administrador' }, updated: { ...regularUser, banned: true }, result: 'Reactivar', fallback: 'No se pudo actualizar el estado del usuario.' },
	{ method: 'unbanUser', label: 'Reactivar', user: { ...regularUser, banned: true }, args: { userId: regularUser.id }, updated: regularUser, result: 'Suspender', fallback: 'No se pudo actualizar el estado del usuario.' }
] as const;

for (const testCase of mutations) {
	describe(testCase.label, () => {
		it('envía el ID correcto y refresca el estado desde el proveedor', async () => {
			admin.listUsers.mockResolvedValueOnce({ data: { users: [testCase.user] }, error: null });
			const screen = await render(UsersPage);
			admin.listUsers.mockResolvedValueOnce({ data: { users: [testCase.updated] }, error: null });
			await screen.getByRole('button', { name: testCase.label, exact: true }).click();
			await expect.element(screen.getByRole('button', { name: testCase.result, exact: true })).toBeVisible();
			expect(admin[testCase.method]).toHaveBeenCalledExactlyOnceWith(testCase.args);
			expect(admin.listUsers).toHaveBeenCalledTimes(2);
			for (const method of ['createUser', 'updateUser', 'removeUser'] as const) expect(admin[method]).not.toHaveBeenCalled();
		});
		it.each([true, false])('conserva el estado ante error, mensaje del proveedor=%s, y permite reintentar', async (withMessage) => {
			admin.listUsers.mockResolvedValue({ data: { users: [testCase.user] }, error: null });
			admin[testCase.method].mockResolvedValueOnce({ error: withMessage ? { message: 'Operación denegada' } : {} });
			const screen = await render(UsersPage);
			await screen.getByRole('button', { name: testCase.label, exact: true }).click();
			await expect.element(screen.getByText(withMessage ? 'Operación denegada' : testCase.fallback, { exact: true })).toBeVisible();
			expect(admin.listUsers).toHaveBeenCalledTimes(1);
			await expect.element(screen.getByRole('button', { name: testCase.label, exact: true })).toBeEnabled();
			await screen.getByRole('button', { name: testCase.label, exact: true }).click();
			await expect.poll(() => admin.listUsers.mock.calls.length).toBe(2);
			await expect.element(screen.getByText(withMessage ? 'Operación denegada' : testCase.fallback, { exact: true })).not.toBeInTheDocument();
			expect(admin[testCase.method]).toHaveBeenCalledTimes(2);
		});
	});
}

describe('eliminación con confirmación', () => {
	it('muestra el nombre y permite cancelar sin eliminar ni recargar', async () => {
		const screen = await render(UsersPage);
		await screen.getByRole('button', { name: 'Eliminar', exact: true }).click();
		await expect.element(screen.getByRole('alertdialog', { name: `¿Eliminar al usuario ${regularUser.name}?` })).toBeVisible();
		await expect.element(screen.getByText('Esta acción no se puede deshacer.')).toBeVisible();
		await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
		await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument();
		expect(admin.removeUser).not.toHaveBeenCalled(); expect(admin.listUsers).toHaveBeenCalledTimes(1);
	});
	it('elimina solo la cuenta elegida después de cancelar otra con el mismo nombre', async () => {
		const second = { ...administrator, name: regularUser.name };
		admin.listUsers.mockResolvedValue({ data: { users: [regularUser, second] }, error: null });
		const screen = await render(UsersPage);
		await screen.getByRole('row').filter({ hasText: regularUser.email }).getByRole('button', { name: 'Eliminar', exact: true }).click();
		await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
		await screen.getByRole('row').filter({ hasText: second.email }).getByRole('button', { name: 'Eliminar', exact: true }).click();
		admin.listUsers.mockResolvedValueOnce({ data: { users: [regularUser] }, error: null });
		await screen.getByRole('alertdialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
		await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument();
		expect(admin.removeUser).toHaveBeenCalledExactlyOnceWith({ userId: second.id });
		await expect.element(screen.getByText(regularUser.email)).toBeVisible();
		await expect.element(screen.getByText(second.email)).not.toBeInTheDocument();
	});
	it('muestra el estado vacío al eliminar la última cuenta', async () => {
		const screen = await render(UsersPage);
		await screen.getByRole('button', { name: 'Eliminar', exact: true }).click();
		admin.listUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });
		await screen.getByRole('alertdialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
		await expect.element(screen.getByText('No hay usuarios registrados.')).toBeVisible();
		await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument();
	});
	it.each([[{ message: 'No puedes eliminar esta cuenta' }, 'No puedes eliminar esta cuenta'], [{}, 'No se pudo eliminar el usuario.']] as const)('mantiene la confirmación abierta ante %j y permite reintentar', async (error, message) => {
		admin.removeUser.mockResolvedValueOnce({ error });
		const screen = await render(UsersPage);
		await screen.getByRole('button', { name: 'Eliminar', exact: true }).click();
		await screen.getByRole('alertdialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
		await expect.element(screen.getByText(message, { exact: true })).toBeInTheDocument();
		await expect.element(screen.getByRole('alertdialog')).toBeVisible();
		expect(admin.listUsers).toHaveBeenCalledTimes(1);
		await screen.getByRole('alertdialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
		await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument();
		expect(admin.removeUser).toHaveBeenCalledTimes(2);
		await expect.element(screen.getByText(message, { exact: true })).not.toBeInTheDocument();
	});
	it('bloquea la confirmación y evita cerrar al cancelar mientras elimina', async () => {
		const pending = deferred<AuthResult>(); admin.removeUser.mockReturnValueOnce(pending.promise);
		const screen = await render(UsersPage);
		await screen.getByRole('button', { name: 'Eliminar', exact: true }).click();
		await screen.getByRole('alertdialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
		await expect.element(screen.getByRole('button', { name: 'Eliminando...', exact: true })).toBeDisabled();
		await screen.getByRole('button', { name: 'Cancelar', exact: true }).click();
		await expect.element(screen.getByRole('alertdialog')).toBeVisible();
		expect(admin.removeUser).toHaveBeenCalledTimes(1); expect(admin.listUsers).toHaveBeenCalledTimes(1);
		pending.resolve({ error: {} });
		await expect.element(screen.getByRole('alertdialog').getByRole('button', { name: 'Eliminar', exact: true })).toBeEnabled();
		await expect.element(screen.getByRole('button', { name: 'Cancelar', exact: true })).toBeEnabled();
	});
});
