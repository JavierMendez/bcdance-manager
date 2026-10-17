import { describe, expect, it } from 'vitest';
import {
	buildExpiringFullPassStudents,
	buildExpiringPaymentStudents,
	formatDaysUntilExpiry,
	formatHoursUntilExpiry
} from '$lib/dashboard';

const now = new Date('2026-10-16T18:00:00Z');
const day = 86_400_000;
type Entitlement = NonNullable<ReturnType<Parameters<typeof buildExpiringPaymentStudents>[1]['get']>>[number];
const student = (id = 1, active = true) => ({ id, fullName: `Alumno ${id}`, phone: null, active });
const monthly = (days = 3, overrides: Partial<Entitlement> = {}): Entitlement => ({
	entitlementType: 'monthly_plan', startsAt: new Date('2026-10-01T18:00:00Z'),
	endsAt: new Date(now.getTime() + days * day), hoursRemaining: null,
	classesRemaining: null, active: true, planName: 'Mensual', hoursIncluded: null, ...overrides
});
const fullPass = (hours = 2, overrides: Partial<Entitlement> = {}): Entitlement => monthly(10, {
	entitlementType: 'full_pass', planName: 'Full pass', hoursRemaining: hours, hoursIncluded: 12, ...overrides
});

describe('etiquetas de vencimiento del dashboard', () => {
	it.each([[-1, 'Vence hoy'], [0, 'Vence hoy'], [1, 'Vence en 1 día'], [7, 'Vence en 7 días']])(
		'formatea %s días', (days, expected) => expect(formatDaysUntilExpiry(days)).toBe(expected)
	);
	it.each([[-1, 'Sin horas restantes'], [0, 'Sin horas restantes'], [1, 'Queda 1 hora'], [1.5, 'Quedan 1.5 horas']])(
		'formatea %s horas', (hours, expected) => expect(formatHoursUntilExpiry(hours)).toBe(expected)
	);
});

describe('pagos mensuales por vencer', () => {
	it('ordena por urgencia, conserva los datos de contacto y elige el último plan mensual', () => {
		const result = buildExpiringPaymentStudents(
			[student(1), { ...student(2), phone: '5512345678' }],
			new Map([[1, [monthly(1), monthly(7, { planName: 'Renovado' })]], [2, [monthly(0.1)]]]), now
		);
		expect(result).toEqual({ total: 2, items: [
			{ id: 2, fullName: 'Alumno 2', paymentStatus: 'por_vencer', planName: 'Mensual', daysRemaining: 1, phone: '5512345678' },
			{ id: 1, fullName: 'Alumno 1', phone: null, paymentStatus: 'por_vencer', planName: 'Renovado', daysRemaining: 7 }
		] });
	});

	it.each([
		['sin derechos', []], ['vencido', [monthly(-1)]], ['vence exactamente ahora', [monthly(0)]],
		['fuera de los siete días', [monthly(7 + 1 / day)]],
		['plan inactivo', [monthly(2, { active: false })]],
		['sin fecha final', [monthly(2, { endsAt: null })]],
		['solo full pass', [fullPass()]], ['renovación vigente', [monthly(2), monthly(30)]]
	])('excluye alumnos con %s', (_, entitlements) => {
		expect(buildExpiringPaymentStudents([student()], new Map([[1, entitlements]]), now)).toEqual({ items: [], total: 0 });
	});

	it('excluye alumnos inactivos aunque su plan esté por vencer', () => {
		expect(buildExpiringPaymentStudents([student(1, false)], new Map([[1, [monthly()]]]), now).total).toBe(0);
	});

	it.each([0, 2, 5])('limita a %s elementos sin perder el total', (limit) => {
		const students = Array.from({ length: 7 }, (_, i) => student(i + 1));
		const result = buildExpiringPaymentStudents(students, new Map(students.map((s) => [s.id, [monthly(8 - s.id)]])), now, limit);
		expect(result.total).toBe(7);
		expect(result.items.map((s) => s.id)).toEqual([7, 6, 5, 4, 3].slice(0, limit));
	});
});

describe('full pass por agotarse', () => {
	it('elige el pase con menos horas por alumno y ordena por urgencia', () => {
		const result = buildExpiringFullPassStudents([student(1), student(2)], new Map([
			[1, [fullPass(3), fullPass(2, { planName: 'Últimas horas' })]], [2, [fullPass(0.5)]]
		]), now);
		expect(result.total).toBe(2);
		expect(result.items).toEqual([
			{ id: 2, fullName: 'Alumno 2', phone: null, paymentStatus: 'por_vencer', planName: 'Full pass', hoursRemaining: 0.5 },
			{ id: 1, fullName: 'Alumno 1', phone: null, paymentStatus: 'por_vencer', planName: 'Últimas horas', hoursRemaining: 2 }
		]);
	});

	it.each([
		['sin derechos', []], ['mensual', [monthly()]], ['agotado', [fullPass(0)]],
		['saldo negativo', [fullPass(-1)]], ['saldo nulo', [fullPass(2, { hoursRemaining: null })]],
		['sobre el umbral', [fullPass(3.01)]], ['inactivo', [fullPass(2, { active: false })]],
		['vence ahora', [fullPass(2, { endsAt: now })]],
		['vencimiento implícito', [fullPass(2, { startsAt: new Date('2026-08-01T18:00:00Z'), endsAt: null })]]
	])('excluye full pass %s', (_, entitlements) => {
		expect(buildExpiringFullPassStudents([student()], new Map([[1, entitlements]]), now)).toEqual({ items: [], total: 0 });
	});

	it.each([12, null, 24])('incluye el umbral exacto según las horas contratadas (%s)', (hoursIncluded) => {
		const hours = hoursIncluded === 24 ? 6 : 3;
		expect(buildExpiringFullPassStudents([student()], new Map([[1, [fullPass(hours, { hoursIncluded })]]]), now).items[0]?.hoursRemaining).toBe(hours);
	});

	it('excluye alumnos inactivos y aplica el límite por defecto conservando el total', () => {
		const students = Array.from({ length: 8 }, (_, i) => student(i, i !== 0));
		const result = buildExpiringFullPassStudents(students, new Map(students.map((s) => [s.id, [fullPass(1)]])), now);
		expect(result.total).toBe(7);
		expect(result.items).toHaveLength(5);
		expect(result.items.some((s) => s.id === 0)).toBe(false);
	});

	it('maneja listas vacías y un límite cero', () => {
		expect(buildExpiringFullPassStudents([], new Map(), now)).toEqual({ items: [], total: 0 });
		expect(buildExpiringFullPassStudents([student()], new Map([[1, [fullPass()]]]), now, 0)).toEqual({ items: [], total: 1 });
	});
});
