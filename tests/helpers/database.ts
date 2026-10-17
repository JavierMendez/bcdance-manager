import { vi } from 'vitest';

// Doble de Drizzle: las filas se suministran por consulta. No interpreta SQL ni
// simula restricciones o rollback de Postgres; la lógica de negocio sigue siendo real.
export function queryRows(rows: unknown[]) {
	const query = Object.assign(Promise.resolve(rows), {
		from: vi.fn(() => query), where: vi.fn((_condition?: unknown) => query),
		innerJoin: vi.fn(() => query), leftJoin: vi.fn(() => query),
		orderBy: vi.fn(() => query), limit: vi.fn((_limit: number) => query), offset: vi.fn((_offset: number) => query),
		returning: vi.fn(() => query)
	});
	return query;
}
export function mockDatabase(...selectRows: unknown[][]) {
	const select = vi.fn();
	for (const rows of selectRows) select.mockReturnValueOnce(queryRows(rows));
	const insertValues = vi.fn((_values: unknown) => queryRows([{ id: 100 }]));
	const set = vi.fn((_values: unknown) => queryRows([]));
	const db = {
		select, insert: vi.fn((_table: unknown) => ({ values: insertValues })),
		update: vi.fn((_table: unknown) => ({ set })),
		transaction: vi.fn(async (callback: (tx: unknown) => unknown): Promise<unknown> => callback(db))
	};
	return { db, select, insertValues, set };
}
export function actionEvent(fields: Record<string, string | string[]>, groupId = '10') {
	const body = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		for (const item of Array.isArray(value) ? value : [value]) body.append(key, item);
	}
	return { request: new Request('http://localhost/dashboard/clases', { method: 'POST', body }), params: { groupId } };
}
