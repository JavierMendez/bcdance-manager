import { beforeEach, vi } from 'vitest';

export type TestUser = {
	id: string;
	name: string;
	email: string;
	role?: string | null;
	banned?: boolean | null;
	createdAt: Date | string;
};
export type AuthResult = { error: { message?: string } | null };
export type ListResult = AuthResult & { data: { users?: TestUser[] } | null };
export const regularUser: TestUser = {
	id: 'user-1', name: 'María Pérez', email: 'maria@example.com', role: 'user',
	banned: false, createdAt: '2026-10-17T12:00:00Z'
};
export const administrator: TestUser = {
	...regularUser, id: 'admin-1', name: 'Administradora', email: 'admin@example.com', role: 'admin'
};
export const admin = {
	listUsers: vi.fn<(input: { query: { limit: number; sortBy: string; sortDirection: string } }) => Promise<ListResult>>(),
	createUser: vi.fn<(input: { name: string; email: string; password: string; role: string }) => Promise<AuthResult>>(),
	updateUser: vi.fn<(input: { userId: string; data: { name: string } }) => Promise<AuthResult>>(),
	setRole: vi.fn<(input: { userId: string; role: string }) => Promise<AuthResult>>(),
	banUser: vi.fn<(input: { userId: string; banReason: string }) => Promise<AuthResult>>(),
	unbanUser: vi.fn<(input: { userId: string }) => Promise<AuthResult>>(),
	removeUser: vi.fn<(input: { userId: string }) => Promise<AuthResult>>()
};
export function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { promise, resolve };
}
beforeEach(() => {
	for (const method of Object.values(admin)) method.mockReset();
	admin.listUsers.mockResolvedValue({ data: { users: [regularUser] }, error: null });
	admin.createUser.mockResolvedValue({ error: null });
	admin.updateUser.mockResolvedValue({ error: null });
	admin.setRole.mockResolvedValue({ error: null });
	admin.banUser.mockResolvedValue({ error: null });
	admin.unbanUser.mockResolvedValue({ error: null });
	admin.removeUser.mockResolvedValue({ error: null });
});
