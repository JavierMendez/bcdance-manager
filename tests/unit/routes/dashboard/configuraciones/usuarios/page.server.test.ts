import { describe, expect, it, vi } from 'vitest';
import { load } from '../../../../../../src/routes/dashboard/configuraciones/usuarios/+page.server';
import { load as loadLayout } from '../../../../../../src/routes/dashboard/+layout.server';
import { authData } from '../../../../../helpers/payments';

describe('acceso a configuraciones de usuarios', () => {
	it('permite el acceso al administrador después de consultar al padre', async () => {
		const parent = vi.fn().mockResolvedValue({ role: 'admin' });
		await expect(load({ parent } as unknown as Parameters<typeof load>[0])).resolves.toBeUndefined();
		expect(parent).toHaveBeenCalledOnce();
	});
	it.each(['user', '', 'ADMIN', 'admin,user', null, undefined])('rechaza el rol %j', async (role) => {
		await expect(load({ parent: async () => ({ role }) } as unknown as Parameters<typeof load>[0]))
			.rejects.toMatchObject({ status: 303, location: '/dashboard?error=unauthorized' });
	});
	it('propaga el fallo del padre', async () => {
		const error = new Error('Sesión no disponible');
		await expect(load({ parent: vi.fn().mockRejectedValue(error) } as unknown as Parameters<typeof load>[0])).rejects.toBe(error);
	});
	it.each(['admin', 'user'])('el layout protege la ruta para %s', async (role) => {
		const user = { ...authData.user, role };
		const event = {
			locals: { user, session: { id: 'session-1', userId: user.id } },
			url: new URL('http://localhost/dashboard/configuraciones/usuarios')
		} as Parameters<typeof loadLayout>[0];
		if (role === 'admin') await expect(loadLayout(event)).resolves.toMatchObject({ user, role });
		else await expect(loadLayout(event)).rejects.toMatchObject({ status: 303, location: '/dashboard?error=unauthorized' });
	});
	it.each([{ user: null, session: null }, { user: authData.user, session: null }, { user: null, session: { id: 'session-1' } }])('exige una sesión completa: %j', async (locals) => {
		await expect(loadLayout({ locals, url: new URL('http://localhost/dashboard/configuraciones/usuarios') } as Parameters<typeof loadLayout>[0]))
			.rejects.toMatchObject({ status: 303, location: '/login' });
	});
});
