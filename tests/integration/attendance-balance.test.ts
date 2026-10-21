import { AsyncLocalStorage } from 'node:async_hooks';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { isRedirect } from '@sveltejs/kit';
import { connection, deadline, gate, observedDatabase, prepareDatabase } from './helpers/postgres.js';
import * as schema from '../../src/lib/server/db/schema/index.js';

const mocked = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('$lib/server/db/index.js', () => ({ getDb: mocked.getDb }));
import { actions } from '../../src/routes/dashboard/clases/asistencia/+page.server.js';

type Db = ReturnType<typeof connection>['db'];
type Entry = { studentId: number; entitlementId: number; status: 'attended' | 'absent' };
const context = new AsyncLocalStorage<Db>();
let observer: ReturnType<typeof connection>;
let first: ReturnType<typeof connection>;
let second: ReturnType<typeof connection>;
let firstPid: number;
let secondPid: number;
let groupId: number;
let studentId: number;
let entitlementId: number;
const dayA = '2026-10-19';
const dayB = '2026-10-26';

async function fixture(type = 'full_pass', balance = 4) {
	const db = observer.db;
	const [student] = await db.insert(schema.students).values({ fullName: 'Concurrency fixture' }).returning();
	const [plan] = await db.insert(schema.paymentPlans).values({ name: 'Fixture', description: '', planType: type === 'monthly_plan' ? 'monthly' : type, price: 100, billingPeriod: 'monthly' }).returning();
	const [payment] = await db.insert(schema.payments).values({ studentId: student.id, purchaseType: 'full_pass_only', subtotalAmount: 100, totalAmount: 100, paymentMethod: 'Efectivo', paidAt: new Date('2026-10-01T12:00:00Z') }).returning();
	const [entitlement] = await db.insert(schema.studentEntitlements).values({ studentId: student.id, paymentId: payment.id, paymentPlanId: plan.id, entitlementType: type, groupId: type === 'full_pass' ? null : groupId, startsAt: new Date('2026-10-01T00:00:00Z'), endsAt: type === 'drop_in' ? null : new Date('2026-11-01T23:59:59Z'), hoursRemaining: type === 'full_pass' ? balance : null, classesRemaining: type === 'drop_in' ? balance : null }).returning();
	return { studentId: student.id, entitlementId: entitlement.id, status: 'attended' as const };
}

function entry(status: Entry['status'] = 'attended'): Entry { return { studentId, entitlementId, status }; }
async function save(db: Db, date: string, entries: Entry[]) {
	const form = new FormData();
	form.set('groupId', String(groupId));
	form.set('sessionDate', date);
	form.set('entries', JSON.stringify(entries));
	return context.run(db, async () => {
		try {
			return await actions.save!({ request: new Request('http://test/dashboard/clases/asistencia?/save', { method: 'POST', body: form }) } as Parameters<NonNullable<typeof actions.save>>[0]);
		} catch (error) {
			if (isRedirect(error)) return { success: true, location: error.location, status: error.status };
			throw error;
		}
	});
}
function expectSuccess(result: unknown) {
	expect(result).toMatchObject({ success: true, status: 303 });
}
async function persisted(id = entitlementId) {
	const [entitlement] = await observer.db.select().from(schema.studentEntitlements).where(eq(schema.studentEntitlements.id, id));
	const marks = await observer.db.select().from(schema.classAttendance).where(eq(schema.classAttendance.entitlementId, id));
	return { entitlement, marks };
}

/** The first actor really owns the row; PostgreSQL must report the other backend waiting
 * before release. No timers/sleeps decide the ordering of database operations. */
async function overlap(date1: string, entries1: Entry[], date2 = date1, entries2 = entries1) {
	const acquired = gate();
	const release = gate();
	let reads = 0;
	const db = observedDatabase(first.db, async () => {
		if (++reads === 1) { acquired.release(); await release.promise; }
	});
	const a = save(db, date1, entries1);
	let b: ReturnType<typeof save> | undefined;
	try {
		await deadline(acquired.promise, 'first entitlement read');
		b = save(second.db, date2, entries2);
		await deadline((async () => {
			const end = Date.now() + 10000;
			while (Date.now() < end) {
				const [row] = await observer.client`select pg_blocking_pids(${secondPid}) as blockers, wait_event_type from pg_stat_activity where pid = ${secondPid}`;
				if (row?.blockers.includes(firstPid) && row.wait_event_type === 'Lock') {
					return;
				}
			}
			throw new Error('Second backend never waited for first backend row lock');
		})(), 'PostgreSQL lock observation');
		release.release();
		return await deadline(Promise.all([a, b]), 'concurrent saves');
	} finally {
		release.release();
		await Promise.allSettled([a, ...(b ? [b] : [])]);
	}
}

beforeAll(async () => {
	await prepareDatabase();
	observer = connection(); first = connection(); second = connection();
	mocked.getDb.mockImplementation(() => context.getStore());
	[firstPid, secondPid] = await Promise.all([first.client`select pg_backend_pid() as pid`, second.client`select pg_backend_pid() as pid`]).then((rows) => rows.map((row) => Number(row[0].pid)));
	expect(firstPid).not.toBe(secondPid);
});
beforeEach(async () => {
	await observer.client`truncate class_attendance, student_entitlements, payment_items, payments, payment_plans, students, groups, programs restart identity cascade`;
	const [program] = await observer.db.insert(schema.programs).values({ name: 'Fixture', description: '' }).returning();
	const [group] = await observer.db.insert(schema.groups).values({ programId: program.id, schedule: '18:00', days: ['Lunes'], isActive: true }).returning();
	groupId = group.id;
	({ studentId, entitlementId } = await fixture());
});
afterAll(async () => {
	await Promise.all([observer, first, second].filter(Boolean).map(({ client }) => client.end()));
});

describe('attendance action with real PostgreSQL transactions', () => {
	it('reproduces the previous lost deduction when only FOR UPDATE is omitted', async () => {
		const bothRead = gate();
		let reads = 0;
		const pause = async () => { if (++reads === 2) bothRead.release(); await deadline(bothRead.promise, 'both unlocked reads'); };
		const results = await Promise.all([
			save(observedDatabase(first.db, pause, true), dayA, [entry()]),
			save(observedDatabase(second.db, pause, true), dayB, [entry()])
		]);
		results.forEach(expectSuccess);
		const { entitlement, marks } = await persisted();
		expect(marks).toHaveLength(2);
		expect(entitlement.hoursRemaining).toBe(3); // Should be 2: proves the old protocol loses a debit.
	});
	it('deducts both full-pass sessions after an observed row-lock wait', async () => {
		(await overlap(dayA, [entry()], dayB)).forEach(expectSuccess);
		const { entitlement, marks } = await persisted();
		expect(entitlement.hoursRemaining).toBe(2);
		expect(marks).toHaveLength(2);
		expect(marks.map((mark) => mark.hoursDeducted)).toEqual([1, 1]);
	});
	it('repeating the same mark concurrently only deducts once and avoids uniqueness failures', async () => {
		(await overlap(dayA, [entry()])).forEach(expectSuccess);
		const { entitlement, marks } = await persisted();
		expect(entitlement.hoursRemaining).toBe(3);
		expect(marks).toHaveLength(1);
	});
	it('two cancellations restore exactly one full-pass unit', async () => {
		expectSuccess(await save(first.db, dayA, [entry()]));
		(await overlap(dayA, [entry('absent')])).forEach(expectSuccess);
		const { entitlement, marks } = await persisted();
		expect(entitlement.hoursRemaining).toBe(4);
		expect(marks).toHaveLength(1);
		expect(marks[0]).toMatchObject({ status: 'absent', hoursDeducted: 0 });
	});
	it('the last full-pass unit is consumed by only one session without a partial mark', async () => {
		await observer.db.update(schema.studentEntitlements).set({ hoursRemaining: 1 }).where(eq(schema.studentEntitlements.id, entitlementId));
		const [a, b] = await overlap(dayA, [entry()], dayB);
		expectSuccess(a);
		expect(b).toMatchObject({ status: 400, data: { message: 'El pago del alumno ya no está vigente. No se puede registrar asistencia.' } });
		const { entitlement, marks } = await persisted();
		expect(entitlement.hoursRemaining).toBe(0);
		expect(marks).toHaveLength(1);
		expect(marks[0].sessionDate).toBe(dayA);
		expect(await observer.db.select().from(schema.payments)).toHaveLength(1);
	});
	it('drop-in credits are deducted in two different sessions', async () => {
		const dropIn = await fixture('drop_in', 2);
		(await overlap(dayA, [dropIn], dayB)).forEach(expectSuccess);
		const { entitlement, marks } = await persisted(dropIn.entitlementId);
		expect(entitlement.classesRemaining).toBe(0);
		expect(marks).toHaveLength(2);
		expect(marks.map((mark) => mark.classesDeducted)).toEqual([1, 1]);
	});
	it('two cancellations restore exactly one drop-in credit', async () => {
		const dropIn = await fixture('drop_in', 2);
		expectSuccess(await save(first.db, dayA, [dropIn]));
		(await overlap(dayA, [{ ...dropIn, status: 'absent' }])).forEach(expectSuccess);
		const { entitlement, marks } = await persisted(dropIn.entitlementId);
		expect(entitlement.classesRemaining).toBe(2);
		expect(marks).toHaveLength(1);
		expect(marks[0]).toMatchObject({ status: 'absent', classesDeducted: 0 });
	});
	it('monthly marks are also serialized without introducing a balance', async () => {
		const monthly = await fixture('monthly_plan');
		(await overlap(dayA, [monthly])).forEach(expectSuccess);
		const { entitlement, marks } = await persisted(monthly.entitlementId);
		expect(entitlement.hoursRemaining).toBeNull();
		expect(entitlement.classesRemaining).toBeNull();
		expect(marks).toHaveLength(1);
		expect(marks[0]).toMatchObject({ hoursDeducted: 0, classesDeducted: 0 });
	});
	it('rolls back a prior debit and insert when a later entry fails', async () => {
		const invalid = await fixture();
		await observer.db.update(schema.studentEntitlements).set({ active: false }).where(eq(schema.studentEntitlements.id, invalid.entitlementId));
		const result = await save(first.db, dayA, [entry(), invalid]);
		expect(result).toMatchObject({ status: 400, data: { message: `Vigencia no válida para el alumno ${invalid.studentId}.` } });
		const { entitlement, marks } = await persisted();
		expect(entitlement.hoursRemaining).toBe(4);
		expect(marks).toHaveLength(0);
		expect((await persisted(invalid.entitlementId)).marks).toHaveLength(0);
	});
	it('oppositely ordered batches complete without deadlock and persist every debit', async () => {
		const other = await fixture();
		(await overlap(dayA, [other, entry()], dayB, [entry(), other])).forEach(expectSuccess);
		for (const id of [entitlementId, other.entitlementId]) {
			const { entitlement, marks } = await persisted(id);
			expect(entitlement.hoursRemaining).toBe(2);
			expect(marks).toHaveLength(2);
		}
	});
});
