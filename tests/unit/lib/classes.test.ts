import { describe, expect, it } from 'vitest';
import { validateClassScheduleInput, parseIsActiveFormValue, parseOptionalDate } from '$lib/courses';
import { buildClassGroups, countMonthlyEnrolledStudents, countFullPassStudents,
	attachSessionAttendanceCountsToGroups, attachDropInPaymentsToGroups } from '$lib/groups';
import { classGroup, entitlement, now } from '../../helpers/classes';

describe('horarios y fechas de clases', () => {
	it('normaliza horario y fechas y descarta días desconocidos', () => {
		const result = validateClassScheduleInput({ schedule: ' 18:00 ', days: ['Viernes', 'Inválido' as 'Viernes'], startDate: ' 2026-10-01 ', endDate: '' });
		expect(result).toEqual({ errors: {}, values: { schedule: '18:00', days: ['Viernes'], startDate: '2026-10-01', endDate: '', isActive: true } });
	});
	it.each(['', '  '])('rechaza horario vacío (%j)', (schedule) => {
		expect(validateClassScheduleInput({ schedule, days: [], startDate: '', endDate: '' }).errors).toEqual({ schedule: 'El horario es obligatorio.', days: 'Selecciona al menos un día.' });
	});
	it('rechaza fechas invertidas y acepta límites iguales y fechas opcionales', () => {
		const data = { schedule: '18:00', days: ['Viernes' as const], startDate: '2026-10-16', endDate: '2026-10-15' };
		expect(validateClassScheduleInput(data).errors.endDate).toBeDefined();
		expect(validateClassScheduleInput({ ...data, endDate: data.startDate }).errors).toEqual({});
		expect(validateClassScheduleInput({ ...data, startDate: '', endDate: '' }).errors).toEqual({});
	});
	it.each([[null, true], ['', true], ['true', true], ['false', false], ['on', false]] as const)('interpreta isActive=%s como %s', (value, expected) => {
		expect(parseIsActiveFormValue(value)).toBe(expected);
	});
	it('permite el fallback inactivo y convierte fechas vacías en null', () => {
		expect(parseIsActiveFormValue(null, false)).toBe(false);
		expect(parseOptionalDate('  ')).toBeNull();
		expect(parseOptionalDate(' 2026-10-16 ')).toBe('2026-10-16');
	});
});

describe('agrupación y contadores de clases', () => {
	it('maneja grupos y derechos vacíos', () => {
		expect(buildClassGroups([], [], now)).toEqual([]);
		expect(buildClassGroups([classGroup], [], now)[0]).toMatchObject({ members: [], enrolledCount: 0 });
	});
	it('deduplica inscripciones y excluye mensualidades vencidas y de otras clases', () => {
		const rows = [entitlement, entitlement, { ...entitlement, student: { ...entitlement.student, id: 2 }, endsAt: now }, { ...entitlement, groupId: 99 }];
		expect(buildClassGroups([classGroup], rows, now)[0].enrolledCount).toBe(1);
		expect(buildClassGroups([classGroup], rows, now)[0].members).toHaveLength(1);
		expect(countMonthlyEnrolledStudents(rows, now)).toBe(1);
	});
	it('combina mensualidad y créditos en un solo alumno', () => {
		const groups = buildClassGroups([classGroup], [entitlement, { ...entitlement, entitlementType: 'drop_in', classesRemaining: 2 }], now);
		expect(groups[0].members).toHaveLength(1);
		expect(groups[0].members[0].modalityLabel).toContain('Por clase');
	});
	it('cuenta full pass únicos con saldo vigente', () => {
		const full = { ...entitlement, entitlementType: 'full_pass', hoursRemaining: 1 };
		expect(countFullPassStudents([full, full, { ...full, student: { ...full.student, id: 2 }, hoursRemaining: 0 }], now)).toBe(1);
	});
	it('cuenta full pass por sesión sin duplicar alumnos ni mensualidades', () => {
		const row = { groupId: 10, studentId: 1, entitlementType: 'full_pass' };
		expect(attachSessionAttendanceCountsToGroups([classGroup], [row, row, { ...row, studentId: 2, entitlementType: 'monthly_plan' }])[0].fullPassCount).toBe(1);
	});
	it('adjunta pagos sin alumno con créditos por defecto y descarta pagos sin grupo', () => {
		const payment = { groupId: 10, paymentId: 1, studentName: null, planName: 'Suelta', totalAmount: 100, paymentMethod: 'Efectivo', classesGranted: null, paidAt: now };
		const [group] = attachDropInPaymentsToGroups([classGroup], [payment, { ...payment, groupId: null }]);
		expect(group.dropInCount).toBe(1);
		expect(group.dropInPayments).toHaveLength(1);
		expect(group.dropInPayments[0].studentName).toBe('Sin alumno');
	});
});
