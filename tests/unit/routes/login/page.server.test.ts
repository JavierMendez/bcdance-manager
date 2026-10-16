import { describe, expect, it } from 'vitest';
import { load } from '../../../../src/routes/login/+page.server';

type LoadEvent = Parameters<typeof load>[0];

// El loader solo consulta locals; los demás campos del evento no intervienen.
function eventWith(locals: Partial<App.Locals>): LoadEvent {
	return { locals: { user: null, session: null, ...locals } } as LoadEvent;
}

const user = { id: 'user-1' } as NonNullable<App.Locals['user']>;
const session = { id: 'session-1', userId: user.id } as NonNullable<App.Locals['session']>;

describe('carga de la página de login', () => {
	it('redirige al dashboard cuando existen usuario y sesión', async () => {
		await expect(load(eventWith({ user, session }))).rejects.toMatchObject({
			status: 303,
			location: '/dashboard'
		});
	});

	it.each([
		{ nombre: 'sin usuario ni sesión', locals: {} },
		{ nombre: 'con usuario pero sin sesión', locals: { user } },
		{ nombre: 'con sesión pero sin usuario', locals: { session } }
	])('permite abrir el login $nombre', async ({ locals }) => {
		await expect(load(eventWith(locals))).resolves.toBeUndefined();
	});
});
