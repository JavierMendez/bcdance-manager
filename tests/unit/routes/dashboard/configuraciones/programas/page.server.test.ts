import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { load, actions } from '../../../../../../src/routes/dashboard/configuraciones/programas/+page.server';
import { programs, groups } from '$lib/server/db/schema/index';
import { actionEvent, mockDatabase, queryRows } from '../../../../../helpers/database';
import { load as loadDashboardLayout } from '../../../../../../src/routes/dashboard/+layout.server';
import { authData } from '../../../../../helpers/payments';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('$lib/server/db/index.js', () => ({ getDb }));
const now = new Date('2026-10-17T18:00:00Z');
const program = { id: 1, name: 'Salsa', description: 'Nivel inicial', createdAt: now, updatedAt: now };
const valid = { id: '1', name: '  Salsa  ', description: '  Nivel inicial  ' };
const runLoad = () => load({} as Parameters<typeof load>[0]);
function update(fields: Record<string, string> = valid) {
	return actions.update({ request: actionEvent(fields).request } as Parameters<typeof actions.update>[0]);
}
beforeEach(() => { getDb.mockReset(); vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => vi.useRealTimers());

describe('acceso a configuraciones/programas', () => {
	it.each(['admin', 'user'] as const)('controla el acceso con rol %s', async (role) => {
		const user = { ...authData.user, role };
		const session = { id: 'session-1', userId: user.id } as NonNullable<App.Locals['session']>;
		const event = { locals: { user, session }, url: new URL('http://localhost/dashboard/configuraciones/programas') } as Parameters<typeof loadDashboardLayout>[0];
		if (role === 'admin') await expect(loadDashboardLayout(event)).resolves.toMatchObject({ user, role });
		else await expect(loadDashboardLayout(event)).rejects.toMatchObject({ status: 303, location: '/dashboard?error=unauthorized' });
	});
});

describe('carga de configuraciones/programas', () => {
	it('devuelve una lista vacía', async () => {
		getDb.mockReturnValue(mockDatabase([]).db);
		await expect(runLoad()).resolves.toEqual({ programs: [] });
	});
	it('conserva programas sin clases y los conteos de uso', async () => {
		const rows = [
			{ id: 2, name: 'Bachata', description: 'Principiantes', classCount: 0 },
			{ id: 1, name: 'Salsa', description: 'Nivel inicial', classCount: 3 }
		];
		getDb.mockReturnValue(mockDatabase(rows).db);
		await expect(runLoad()).resolves.toEqual({ programs: rows });
	});
	it('usa LEFT JOIN y cuenta clases por programa sin excluir programas no usados', async () => {
		const db = mockDatabase([]); getDb.mockReturnValue(db.db);
		await runLoad();
		const query = db.select.mock.results[0].value as ReturnType<typeof queryRows>;
		expect(query.leftJoin).toHaveBeenCalledOnce();
		expect(query.where).not.toHaveBeenCalled();
		expect(query.groupBy).toHaveBeenCalledWith(programs.id, programs.name, programs.description, programs.createdAt);
		const projection = db.select.mock.calls[0][0] as { classCount: SQL };
		const compiled = new PgDialect().sqlToQuery(projection.classCount);
		expect(compiled.sql).toContain('count("groups"."id")');
		expect(query.orderBy).toHaveBeenCalledOnce();
	});
	it('propaga errores de lectura', async () => {
		const db = mockDatabase(); getDb.mockReturnValue(db.db);
		const error = new Error('Consulta no disponible');
		db.select.mockImplementationOnce(() => { throw error; });
		await expect(runLoad()).rejects.toBe(error);
	});
});

describe('edición de programas', () => {
	it('guarda datos normalizados y devuelve únicamente el programa serializado', async () => {
		const db = mockDatabase(); getDb.mockReturnValue(db.db);
		const query = queryRows([program]); db.set.mockReturnValue(query);
		await expect(update()).resolves.toEqual({ success: true, mode: 'edit', program: { id: 1, name: 'Salsa', description: 'Nivel inicial' } });
		expect(db.db.update).toHaveBeenCalledExactlyOnceWith(programs);
		expect(db.set).toHaveBeenCalledExactlyOnceWith({ name: 'Salsa', description: 'Nivel inicial', updatedAt: now });
		const sql = new PgDialect().sqlToQuery(query.where.mock.calls[0][0] as SQL);
		expect(sql.params).toEqual([1]);
	});
	it.each(['', '0', 'texto'])('rechaza identificador %j antes de consultar la base de datos', async (id) => {
		await expect(update({ ...valid, id })).resolves.toMatchObject({ status: 400, data: { message: 'Programa no válido.' } });
		expect(getDb).not.toHaveBeenCalled();
	});
	it.each([{ name: '' }, { description: '' }, { name: ' ', description: '\n' }])('rechaza campos vacíos y conserva el contexto de edición: %j', async (invalid) => {
		await expect(update({ ...valid, ...invalid })).resolves.toMatchObject({ status: 400, data: { mode: 'edit', id: 1, errors: expect.any(Object), values: { name: invalid.name?.trim() ?? 'Salsa', description: invalid.description?.trim() ?? 'Nivel inicial' } } });
		expect(getDb).not.toHaveBeenCalled();
	});
	it('maneja campos ausentes del formulario', async () => {
		await expect(update({ id: '1' })).resolves.toMatchObject({ status: 400, data: { errors: { name: 'El nombre es obligatorio.', description: 'La descripción es obligatoria.' } } });
		expect(getDb).not.toHaveBeenCalled();
	});
	it('devuelve 404 cuando el programa desapareció', async () => {
		getDb.mockReturnValue(mockDatabase().db);
		await expect(update()).resolves.toMatchObject({ status: 404, data: { message: 'Programa no encontrado.' } });
	});
	it('ignora conteos y metadatos enviados por el cliente y no modifica las clases', async () => {
		const db = mockDatabase(); getDb.mockReturnValue(db.db); db.set.mockReturnValue(queryRows([program]));
		await update({ ...valid, classCount: '999', createdAt: '2000-01-01', programId: '999' });
		expect(db.set).toHaveBeenCalledExactlyOnceWith({ name: 'Salsa', description: 'Nivel inicial', updatedAt: now });
		expect(db.db.update).not.toHaveBeenCalledWith(groups);
		expect(db.db.insert).not.toHaveBeenCalled();
		expect(db.db.delete).not.toHaveBeenCalled();
	});
	it('propaga fallos de escritura sin devolver éxito', async () => {
		const db = mockDatabase(); getDb.mockReturnValue(db.db);
		const error = new Error('No se pudo guardar');
		db.set.mockImplementationOnce(() => { throw error; });
		await expect(update()).rejects.toBe(error);
	});
});
