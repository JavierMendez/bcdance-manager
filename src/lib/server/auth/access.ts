import type { AppRole } from '$lib/auth/roles.js';

const USER_ROUTE_PATTERNS = [
	/^\/dashboard$/,
	/^\/dashboard\/alumnos(\/.*)?$/,
	/^\/dashboard\/clases(\/.*)?$/,
	/^\/dashboard\/pagos(\/.*)?$/,
	/^\/dashboard\/grupos(\/.*)?$/
];

export function getAppRole(user: { role?: string | null }): AppRole {
	return user.role === 'admin' ? 'admin' : 'user';
}

export function canAccessRoute(role: AppRole, pathname: string): boolean {
	if (role === 'admin') return true;
	return USER_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}
