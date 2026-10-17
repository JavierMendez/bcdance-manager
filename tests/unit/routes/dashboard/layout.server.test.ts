import { describe, expect, it } from 'vitest';
import { load } from '../../../../src/routes/dashboard/+layout.server';

type LoadEvent = Parameters<typeof load>[0];
const user = { id: 'user-1', role: 'user' } as NonNullable<App.Locals['user']>;
const session = { id: 'session-1', userId: user.id } as NonNullable<App.Locals['session']>;
function eventWith(locals: Partial<App.Locals>, pathname = '/dashboard'): LoadEvent {
	return { locals: { user: null, session: null, ...locals }, url: new URL(pathname, 'http://localhost') } as LoadEvent;
}

describe('control de acceso al dashboard', () => {
	it.each([{}, { user }, { session }])('redirige sesiones incompletas al login (%j)', async (locals) => {
		await expect(load(eventWith(locals))).rejects.toMatchObject({ status: 303, location: '/login' });
	});
	it.each(['admin', 'user', null, 'rol-desconocido'])('permite el inicio con rol %s y devuelve el rol normalizado', async (role) => {
		const currentUser = { ...user, role };
		await expect(load(eventWith({ user: currentUser, session }))).resolves.toEqual({ user: currentUser, role: role === 'admin' ? 'admin' : 'user' });
	});
	it('permite las configuraciones al administrador', async () => {
		await expect(load(eventWith({ user: { ...user, role: 'admin' }, session }, '/dashboard/configuraciones/usuarios'))).resolves.toMatchObject({ role: 'admin' });
	});
	it.each(['/dashboard/configuraciones/usuarios', '/dashboard/flujo-de-efectivo', '/dashboard/alumnos-ajenos'])('rechaza la ruta restringida %s', async (pathname) => {
		await expect(load(eventWith({ user, session }, pathname))).rejects.toMatchObject({ status: 303, location: '/dashboard?error=unauthorized' });
	});
});
