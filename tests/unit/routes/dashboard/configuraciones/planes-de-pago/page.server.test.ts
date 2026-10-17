import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { load, actions } from '../../../../../../src/routes/dashboard/configuraciones/planes-de-pago/+page.server';
import { load as loadDashboardLayout } from '../../../../../../src/routes/dashboard/+layout.server';
import { paymentPlans, payments } from '$lib/server/db/schema/index';
import { mockDatabase, queryRows, actionEvent } from '../../../../../helpers/database';
import { planValues, planCases } from '../../../../../helpers/payment-plans';
import { monthlyPlan } from '../../../../../helpers/classes';
import { authData } from '../../../../../helpers/payments';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('$lib/server/db/index.js', () => ({ getDb }));
const now = new Date('2026-10-17T18:00:00Z');
const runLoad = () => load({} as Parameters<typeof load>[0]);
function runAction(action: 'create' | 'update', fields: Record<string, string> = { ...planValues, id: '1' }) {
	return actions[action]({ request: actionEvent(fields).request } as Parameters<(typeof actions)[string]>[0]);
}
beforeEach(() => { getDb.mockReset(); vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => vi.useRealTimers());

describe('acceso y carga de planes de pago', () => {
	it.each(['admin', 'user'] as const)('controla el acceso del rol %s', async (role) => {
		const user = { ...authData.user, role };
		const session = { id: 'session-1', userId: user.id } as NonNullable<App.Locals['session']>;
		const event = { locals: { user, session }, url: new URL('http://localhost/dashboard/configuraciones/planes-de-pago') } as Parameters<typeof loadDashboardLayout>[0];
		if (role === 'admin') await expect(loadDashboardLayout(event)).resolves.toMatchObject({ role });
		else await expect(loadDashboardLayout(event)).rejects.toMatchObject({ status: 303, location: '/dashboard?error=unauthorized' });
	});
	it('devuelve un catálogo vacío', async () => {
		getDb.mockReturnValue(mockDatabase([]).db);
		await expect(runLoad()).resolves.toEqual({ paymentPlans: [] });
	});
	it('serializa los tres tipos sin incluir metadatos internos', async () => {
		const rows = planCases.map(({ plan }) => ({ ...plan, createdAt: now, updatedAt: now }));
		getDb.mockReturnValue(mockDatabase(rows).db);
		await expect(runLoad()).resolves.toEqual({ paymentPlans: planCases.map(({ plan }) => plan) });
	});
	it('propaga fallos de lectura', async () => {
		const db = mockDatabase(); getDb.mockReturnValue(db.db);
		const error = new Error('No se pudo consultar'); db.select.mockImplementationOnce(() => { throw error; });
		await expect(runLoad()).rejects.toBe(error);
	});
});

for (const action of ['create', 'update'] as const) {
	describe(`${action} de planes de pago`, () => {
		it.each(planCases)('guarda $type y devuelve el plan serializado', async ({ plan, values }) => {
			const db = mockDatabase(); getDb.mockReturnValue(db.db);
			const query = queryRows([{ ...plan, createdAt: now, updatedAt: now }]);
			if (action === 'create') db.insertValues.mockReturnValue(query);
			else db.set.mockReturnValue(query);
			await expect(runAction(action, { ...values, id: String(plan.id) })).resolves.toEqual({ success: true, mode: action === 'create' ? 'create' : 'edit', paymentPlan: plan });
			const expected = { name: plan.name, description: plan.description, planType: plan.planType, price: plan.price, billingPeriod: plan.billingPeriod, classesIncluded: plan.classesIncluded, hoursIncluded: plan.hoursIncluded, updatedAt: now };
			expect(action === 'create' ? db.insertValues : db.set).toHaveBeenCalledExactlyOnceWith(expected);
			if (action === 'update') expect(new PgDialect().sqlToQuery(query.where.mock.calls[0][0] as SQL).params).toEqual([plan.id]);
		});
		it.each([
			{ name: ' ' }, { description: '' }, { price: '0' }, { price: 'Infinity' },
			{ billingPeriod: 'Inválida' }, { planType: 'desconocido' },
			{ classesIncluded: '-1' }, { planType: 'full_pass', hoursIncluded: '' }
		])('rechaza datos inválidos antes de acceder a DB: %j', async (invalid) => {
			await expect(runAction(action, { ...planValues, id: '1', ...invalid })).resolves.toMatchObject({ status: 400, data: { mode: action === 'create' ? 'create' : 'edit' } });
			expect(getDb).not.toHaveBeenCalled();
		});
		it('conserva valores normalizados y errores simultáneos al fallar', async () => {
			await expect(runAction(action, { ...planValues, id: '1', name: ' ', price: '', description: '' })).resolves.toMatchObject({ status: 400, data: { values: { name: '', description: '', price: '' }, errors: { name: 'El nombre es obligatorio.', description: 'La descripción es obligatoria.', price: 'El precio es obligatorio.' } } });
		});
		it('propaga fallos de escritura', async () => {
			const db = mockDatabase(); getDb.mockReturnValue(db.db);
			const error = new Error('Escritura fallida');
			(action === 'create' ? db.insertValues : db.set).mockImplementationOnce(() => { throw error; });
			await expect(runAction(action)).rejects.toBe(error);
		});
	});
}

describe('casos de borde de edición', () => {
	it.each(['', '0', 'texto'])('rechaza ID %j sin consultar', async (id) => {
		await expect(runAction('update', { ...planValues, id })).resolves.toMatchObject({ status: 400, data: { message: 'Plan de pago no válido.' } });
		expect(getDb).not.toHaveBeenCalled();
	});
	it('devuelve 404 si el plan desapareció', async () => {
		getDb.mockReturnValue(mockDatabase().db);
		await expect(runAction('update')).resolves.toMatchObject({ status: 404, data: { message: 'Plan de pago no encontrado.' } });
	});
	it('actualiza solo el catálogo y conserva los precios de pagos históricos', async () => {
		const db = mockDatabase(); getDb.mockReturnValue(db.db); db.set.mockReturnValue(queryRows([{ ...monthlyPlan, price: 600 }]));
		await runAction('update', { ...planValues, id: '1', price: '600', createdAt: '2000-01-01', paymentId: '999' });
		expect(db.db.update).toHaveBeenCalledExactlyOnceWith(paymentPlans);
		expect(db.db.update).not.toHaveBeenCalledWith(payments);
		expect(db.set).not.toHaveBeenCalledWith(expect.objectContaining({ createdAt: expect.anything() }));
		expect(db.db.delete).not.toHaveBeenCalled();
	});
	it('fuerza Por clase y limpia horas ajenas al cambiar a clase suelta', async () => {
		const db = mockDatabase(); getDb.mockReturnValue(db.db); db.set.mockReturnValue(queryRows([planCases[2].plan]));
		await runAction('update', { ...planValues, id: '3', planType: 'drop_in', billingPeriod: 'Anual', hoursIncluded: '99', classesIncluded: '' });
		expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ billingPeriod: 'Por clase', hoursIncluded: null, classesIncluded: 1 }));
	});
});
