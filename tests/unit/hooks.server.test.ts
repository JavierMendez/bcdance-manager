import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Handle } from '@sveltejs/kit';
import { handle } from '../../src/hooks.server';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), handler: vi.fn() }));
vi.mock('$lib/server/auth.js', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('better-auth/svelte-kit', () => ({ svelteKitHandler: mocks.handler }));
vi.mock('$app/environment', () => ({ building: false }));

const user = { id: 'user-1', role: 'user' };
const session = { id: 'session-1', userId: user.id };
function request(pathname: string, method = 'GET', enhanced = false, routeId: string | null = pathname) {
	const url = new URL(pathname, 'http://localhost');
	const event = {
		url, route: { id: routeId },
		request: new Request(url, { method, headers: enhanced ? { 'x-sveltekit-action': 'true', accept: 'application/json' } : {} }),
		locals: { user: null, session: null }
	} as Parameters<Handle>[0]['event'];
	const resolve = vi.fn().mockResolvedValue(new Response('protected handler'));
	return { event, resolve };
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getSession.mockResolvedValue(null);
	mocks.handler.mockImplementation(({ event, resolve }) => resolve(event));
});

const requests = [ ['GET', false], ['HEAD', false], ['POST', false], ['POST', true] ] as const;
describe('dashboard authorization before dispatch', () => {
	it.each(requests)('rejects unauthenticated %s enhanced=%s before dispatch', async (method, enhanced) => {
		const input = request('/dashboard/flujo-de-efectivo?/createExpense', method, enhanced, '/dashboard/flujo-de-efectivo');
		await expect(handle(input)).rejects.toMatchObject({ status: 303, location: '/login' });
		expect(mocks.handler).not.toHaveBeenCalled();
		expect(input.resolve).not.toHaveBeenCalled();
	});
	it.each([{ user }, { session }, null])('rejects incomplete or expired session %j', async (result) => {
		mocks.getSession.mockResolvedValue(result);
		await expect(handle(request('/dashboard'))).rejects.toMatchObject({ status: 303, location: '/login' });
		expect(mocks.handler).not.toHaveBeenCalled();
	});
	it.each(requests)('rejects restricted user %s enhanced=%s before dispatch', async (method, enhanced) => {
		mocks.getSession.mockResolvedValue({ user, session });
		const input = request('/dashboard/configuraciones/planes-de-pago', method, enhanced);
		await expect(handle(input)).rejects.toMatchObject({ status: 303, location: '/dashboard?error=unauthorized' });
		expect(mocks.handler).not.toHaveBeenCalled();
		expect(input.resolve).not.toHaveBeenCalled();
	});
	it.each(['/dashboard', '/dashboard/alumnos', '/dashboard/clases/asistencia', '/dashboard/pagos/registrar', '/dashboard/grupos/1'])('dispatches allowed route %s with locals', async (pathname) => {
		mocks.getSession.mockResolvedValue({ user, session });
		const input = request(pathname, 'POST');
		await expect(handle(input)).resolves.toBeInstanceOf(Response);
		expect(input.event.locals).toEqual({ user, session });
		expect(input.resolve).toHaveBeenCalledExactlyOnceWith(input.event);
	});
	it.each(['user', null, 'unknown'])('normalizes role %s without granting admin access', async (role) => {
		mocks.getSession.mockResolvedValue({ user: { ...user, role }, session });
		await expect(handle(request('/dashboard/flujo-de-efectivo'))).rejects.toMatchObject({ location: '/dashboard?error=unauthorized' });
	});
	it.each(['/dashboard/flujo-de-efectivo', '/dashboard/configuraciones/usuarios'])('allows administrator %s', async (pathname) => {
		mocks.getSession.mockResolvedValue({ user: { ...user, role: 'admin' }, session });
		const input = request(pathname, 'POST');
		await handle(input);
		expect(input.resolve).toHaveBeenCalledOnce();
	});
	it.each(['/login', '/api/auth/get-session', '/favicon.ico', '/dashboard-ajeno'])('preserves public route %s', async (pathname) => {
		const input = request(pathname, 'GET', false, null);
		await handle(input);
		expect(input.event.locals).toEqual({ user: null, session: null });
		expect(input.resolve).toHaveBeenCalledOnce();
	});
	it('uses the matched route for encoded paths', async () => {
		mocks.getSession.mockResolvedValue({ user, session });
		await expect(handle(request('/%64ashboard/flujo-de-efectivo', 'POST', false, '/dashboard/flujo-de-efectivo'))).rejects.toMatchObject({ location: '/dashboard?error=unauthorized' });
		expect(mocks.handler).not.toHaveBeenCalled();
	});
});
