import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { load } from '../../../../../src/routes/dashboard/pagos/+page.server';
import { mockDatabase, type queryRows } from '../../../../helpers/database';
import { payment, emptyFilters } from '../../../../helpers/payments';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('$lib/server/db/index.js', () => ({ getDb }));
const row = { payment: { ...payment, paidAt: new Date(payment.paidAt) }, studentName: payment.studentName };
function runLoad(params: Record<string, string> = {}) {
	const url = new URL('http://localhost/dashboard/pagos');
	url.search = new URLSearchParams(params).toString();
	return load({ url } as Parameters<typeof load>[0]);
}
function queries(db: ReturnType<typeof mockDatabase>) {
	return db.select.mock.results.map((result) => result.value as ReturnType<typeof queryRows>);
}
beforeEach(() => getDb.mockReset());

describe('carga y paginación de pagos', () => {
	it('devuelve estado vacío con una página y sin filtros SQL', async () => {
		const db = mockDatabase([{ total: 0 }], []); getDb.mockReturnValue(db.db);
		await expect(runLoad()).resolves.toEqual({ payments: [], filters: emptyFilters, pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
		for (const query of queries(db)) expect(query.where).not.toHaveBeenCalled();
	});
	it('serializa fecha, montos y tipo de pago', async () => {
		getDb.mockReturnValue(mockDatabase([{ total: 1 }], [row]).db);
		await expect(runLoad()).resolves.toMatchObject({ payments: [payment], pagination: { total: 1, page: 1 } });
	});
	it('identifica pagos sin alumno y conserva importes cero o descuento total', async () => {
		getDb.mockReturnValue(mockDatabase([{ total: 1 }], [{ payment: { ...row.payment, studentId: null, purchaseType: 'drop_in_only', totalAmount: 0, discountPercent: 100 }, studentName: null }]).db);
		await expect(runLoad()).resolves.toMatchObject({ payments: [{ studentId: null, studentName: 'Sin alumno', totalAmount: 0, discountPercent: 100 }] });
	});
	it.each([
		[0, '99', 1, 1, 0], [20, '2', 1, 1, 0], [21, '99', 2, 2, 20],
		[40, '2', 2, 2, 20], [41, '3', 3, 3, 40], [41, '-1', 1, 3, 0]
	] as const)('limita total=%s y página solicitada=%s', async (total, requested, page, totalPages, offset) => {
		const db = mockDatabase([{ total }], []); getDb.mockReturnValue(db.db);
		await expect(runLoad({ page: requested })).resolves.toMatchObject({ pagination: { page, totalPages, total } });
		const list = queries(db)[1];
		expect(list.limit).toHaveBeenCalledExactlyOnceWith(20);
		expect(list.offset).toHaveBeenCalledExactlyOnceWith(offset);
	});
	it('propaga errores de consulta sin presentar un historial vacío como éxito', async () => {
		const db = mockDatabase(); getDb.mockReturnValue(db.db);
		const error = new Error('Consulta no disponible');
		db.select.mockImplementationOnce(() => { throw error; });
		await expect(runLoad()).rejects.toBe(error);
	});
});

describe('condiciones SQL del historial', () => {
	it('aplica los mismos filtros al conteo y al listado, con fechas inclusivas en México', async () => {
		const db = mockDatabase([{ total: 0 }], []); getDb.mockReturnValue(db.db);
		await runLoad({ type: 'combined', method: 'Efectivo', from: '2026-10-31', to: '2026-10-01', q: ' Ana ' });
		const [count, list] = queries(db);
		const condition = count.where.mock.calls[0][0] as SQL;
		expect(list.where).toHaveBeenCalledExactlyOnceWith(condition);
		const compiled = new PgDialect().sqlToQuery(condition);
		expect(compiled.sql).toContain('>=');
		expect(compiled.sql).toContain('<=');
		expect(compiled.sql).toContain('ILIKE');
		expect(compiled.params).toEqual(['combined', 'Efectivo', 'America/Mexico_City', '2026-10-01', 'America/Mexico_City', '2026-10-31', '%Ana%']);
	});
	it.each(['from', 'to'])('una sola fecha %s restringe ambos extremos al mismo día', async (field) => {
		const db = mockDatabase([{ total: 0 }], []); getDb.mockReturnValue(db.db);
		await runLoad({ [field]: '2026-10-16' });
		const compiled = new PgDialect().sqlToQuery(queries(db)[0].where.mock.calls[0][0] as SQL);
		expect(compiled.params).toEqual(['America/Mexico_City', '2026-10-16', 'America/Mexico_City', '2026-10-16']);
	});
	it('escapa comodines y barra invertida de la búsqueda y usa parámetros', async () => {
		const db = mockDatabase([{ total: 0 }], []); getDb.mockReturnValue(db.db);
		await runLoad({ q: "50%_\\'" });
		const compiled = new PgDialect().sqlToQuery(queries(db)[0].where.mock.calls[0][0] as SQL);
		expect(compiled.params).toEqual(["%50\\%\\_\\\\'%"]);
		expect(compiled.sql).not.toContain('50%');
	});
	it.each(['Sin alumno', 'sin', 'ALUMNO'])('incluye pagos sin alumno al buscar %s', async (q) => {
		const db = mockDatabase([{ total: 0 }], []); getDb.mockReturnValue(db.db);
		await runLoad({ q });
		const compiled = new PgDialect().sqlToQuery(queries(db)[0].where.mock.calls[0][0] as SQL);
		expect(compiled.sql.toLowerCase()).toContain('is null');
		expect(compiled.params).toEqual([`%${q}%`]);
	});
});
