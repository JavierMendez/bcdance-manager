import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { load, actions } from '../../../../../src/routes/dashboard/flujo-de-efectivo/+page.server';
import { mockDatabase, actionEvent, type queryRows } from '../../../../helpers/database';
import { cashFlowNow, period, paymentIncome, additionalIncome, expense, validIncome, validExpense } from '../../../../helpers/cash-flow';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('$lib/server/db/index.js', () => ({ getDb }));
const runLoad = (search = '?preset=custom&from=2026-10-16&to=2026-10-16') => load({ url: new URL(`http://localhost/dashboard/flujo-de-efectivo${search}`) } as Parameters<typeof load>[0]);
function runAction(action: keyof typeof actions, fields: Record<string, string>, search = '?preset=custom&from=2026-10-01&to=2026-10-31') {
	return actions[action]({ request: actionEvent(fields).request, url: new URL(`http://localhost/dashboard/flujo-de-efectivo${search}`) } as Parameters<(typeof actions)[string]>[0]);
}
beforeEach(() => { getDb.mockReset(); vi.useFakeTimers(); vi.setSystemTime(cashFlowNow); });
afterEach(() => vi.useRealTimers());

describe('carga de flujo de efectivo', () => {
	it('devuelve resumen y saldos vacíos sin movimientos', async () => {
		getDb.mockReturnValue(mockDatabase([], [], [], [], [], []).db);
		await expect(runLoad()).resolves.toMatchObject({ period: { from: period.from, to: period.to }, summary: { totalIncome: 0, totalExpenses: 0, movements: [] }, lifetimeBalances: { cash: 0, transfer: 0 } });
	});
	it('integra tres fuentes de movimientos y mantiene los saldos históricos independientes', async () => {
		getDb.mockReturnValue(mockDatabase(
			[{ payment: paymentIncome, studentName: null }], [additionalIncome], [expense],
			[{ paymentMethod: 'Efectivo', total: 5000 }], [{ paymentMethod: 'Transferencia', total: 900 }],
			[{ paymentMethod: 'Efectivo', total: 1500 }]
		).db);
		const result = await runLoad();
		expect(result).toMatchObject({ summary: { totalIncome: 700, totalExpenses: 300, netCashFlow: 400 }, lifetimeBalances: { cash: 3500, transfer: 900 } });
		expect(result?.summary.movements.map((m: { id: string }) => m.id)).toEqual(['expense-1', 'additional-income-1', 'payment-1']);
		expect(result?.summary.movements[2].label).toBe('Sin alumno');
	});
	it('aplica fechas inclusivas de México a las tres fuentes y no filtra los acumulados', async () => {
		const db = mockDatabase([], [], [], [], [], []); getDb.mockReturnValue(db.db);
		await runLoad('?preset=custom&from=2026-10-31&to=2026-10-01');
		const queries = db.select.mock.results.map((r) => r.value as ReturnType<typeof queryRows>);
		for (const query of queries.slice(0, 3)) {
			const sql = new PgDialect().sqlToQuery(query.where.mock.calls[0][0] as SQL);
			expect(sql.sql).toContain('>=');
			expect(sql.sql).toContain('<=');
			expect(sql.params).toEqual(['America/Mexico_City', '2026-10-01', 'America/Mexico_City', '2026-10-31']);
		}
		for (const query of queries.slice(3)) {
			expect(query.where).not.toHaveBeenCalled();
			expect(query.groupBy).toHaveBeenCalledOnce();
		}
	});
	it('propaga fallos de consulta', async () => {
		const db = mockDatabase(); getDb.mockReturnValue(db.db);
		const error = new Error('No se pudo consultar');
		db.select.mockImplementationOnce(() => { throw error; });
		await expect(runLoad()).rejects.toBe(error);
	});
});

describe('crear ingresos adicionales y egresos', () => {
	for (const action of ['createExpense', 'createAdditionalIncome'] as const) {
		const fields = action === 'createExpense' ? validExpense : validIncome;
		const notice = action === 'createExpense' ? 'saved' : 'incomeSaved';
		it(`guarda ${action} normalizado y preserva el periodo`, async () => {
			const db = mockDatabase(); getDb.mockReturnValue(db.db);
			await expect(runAction(action, fields)).rejects.toMatchObject({ status: 303, location: `/dashboard/flujo-de-efectivo?preset=custom&from=2026-10-01&to=2026-10-31&${notice}=1` });
			expect(db.insertValues).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ amount: 200, description: 'Venta de uniformes', paymentMethod: 'Transferencia', paidAt: new Date('2026-10-16T12:00:00Z') }));
		});
		it(`muestra el día del movimiento cuando ${action} queda fuera del periodo`, async () => {
			getDb.mockReturnValue(mockDatabase().db);
			await expect(runAction(action, { ...fields, paidAt: '2026-09-01' })).rejects.toMatchObject({ status: 303, location: `/dashboard/flujo-de-efectivo?preset=custom&from=2026-09-01&to=2026-09-01&${notice}=1` });
		});
		it.each(['2026-10-01', '2026-10-31'])(`conserva el periodo en la fecha límite %s de ${action}`, async (paidAt) => {
			getDb.mockReturnValue(mockDatabase().db);
			await expect(runAction(action, { ...fields, paidAt })).rejects.toMatchObject({ status: 303, location: expect.stringContaining(`from=2026-10-01&to=2026-10-31&${notice}=1`) });
		});
		it.each([{ amount: '0' }, { amount: '1.5' }, { description: ' ' }, { paymentMethod: 'Inválido' }, { paidAt: '' }])(`rechaza campos inválidos de ${action}: %j`, async (invalid) => {
			await expect(runAction(action, { ...fields, ...invalid })).resolves.toMatchObject({ status: 400, data: { mode: action } });
			expect(getDb).not.toHaveBeenCalled();
		});
		it(`propaga fallos de escritura en ${action}`, async () => {
			const db = mockDatabase(); getDb.mockReturnValue(db.db);
			const error = new Error('Escritura fallida');
			db.insertValues.mockImplementationOnce(() => { throw error; });
			await expect(runAction(action, fields)).rejects.toBe(error);
		});
	}
	it('rechaza egreso con categoría inexistente antes de consultar', async () => {
		await expect(runAction('createExpense', { ...validExpense, category: 'inexistente' })).resolves.toMatchObject({ status: 400, data: { errors: { category: expect.any(String) } } });
		expect(getDb).not.toHaveBeenCalled();
	});
});

describe('eliminar ingresos adicionales y egresos', () => {
	for (const [action, field, notice] of [
		['deleteExpense', 'expenseId', 'deleted'], ['deleteAdditionalIncome', 'additionalIncomeId', 'incomeDeleted']
	] as const) {
		it(`elimina ${action} por ID y preserva filtros en la redirección`, async () => {
			const db = mockDatabase(); getDb.mockReturnValue(db.db);
			await expect(runAction(action, { [field]: '7' })).rejects.toMatchObject({ status: 303, location: `/dashboard/flujo-de-efectivo?preset=custom&from=2026-10-01&to=2026-10-31&${notice}=1` });
			const sql = new PgDialect().sqlToQuery(db.deleteWhere.mock.calls[0][0] as SQL);
			expect(sql.params).toEqual([7]);
		});
		it.each(['', '0', 'texto'])(`rechaza ID %j en ${action}`, async (id) => {
			await expect(runAction(action, { [field]: id })).resolves.toMatchObject({ status: 400 });
			expect(getDb).not.toHaveBeenCalled();
		});
		it(`propaga fallos al eliminar con ${action}`, async () => {
			const db = mockDatabase(); getDb.mockReturnValue(db.db);
			const error = new Error('Eliminación fallida');
			db.deleteWhere.mockImplementationOnce(() => { throw error; });
			await expect(runAction(action, { [field]: '7' })).rejects.toBe(error);
		});
	}
});
