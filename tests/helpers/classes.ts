import type { ClassGroup } from '$lib/groups';
import type { AttendanceMember, EligibleFullPassStudent } from '$lib/attendance';
import type { WizardPaymentPlan } from '$lib/payments';

export const now = new Date('2026-10-16T18:00:00Z');
export const programs = [{ id: 1, name: 'Salsa', description: 'Programa de salsa' }];
export const student = { id: 1, fullName: 'Ana Pérez', phone: null, active: true };
export const classGroup: ClassGroup = {
	id: 10, programId: 1, name: 'Salsa', description: 'Programa de salsa',
	schedule: '18:00 - 19:00', days: ['Viernes'], startDate: null, endDate: null,
	isActive: true, active: true, enrolledCount: 0, fullPassCount: 0, dropInCount: 0,
	members: [], dropInPayments: []
};
export const groupRow = {
	id: 10, programId: 1, programName: 'Salsa', programDescription: 'Programa de salsa',
	name: 'Salsa', schedule: classGroup.schedule, days: classGroup.days,
	startDate: null, endDate: null, isActive: true
};
export const monthlyPlan: WizardPaymentPlan = {
	id: 1, name: 'Mensual salsa', description: 'Plan de un mes', planType: 'monthly',
	price: 500, billingPeriod: 'Mensual', classesIncluded: null, hoursIncluded: null
};
export const fullPassPlan: WizardPaymentPlan = {
	...monthlyPlan, id: 2, name: 'Pase 12 horas', planType: 'full_pass', price: 700, hoursIncluded: 12
};
export const dropInPlan: WizardPaymentPlan = {
	...monthlyPlan, id: 3, name: 'Clase suelta', planType: 'drop_in', price: 100,
	billingPeriod: 'Por clase', classesIncluded: 1
};
export const entitlement = {
	id: 20, studentId: 1, groupId: 10, active: true, entitlementType: 'monthly_plan',
	startsAt: new Date('2026-10-01T12:00:00Z'), endsAt: new Date('2026-10-31T12:00:00Z'),
	hoursRemaining: null as number | null, classesRemaining: null as number | null,
	planName: 'Mensual salsa', student
};
export const member: AttendanceMember = {
	studentId: 1, fullName: 'Ana Pérez', modalityLabel: 'Plan mensual', planName: 'Mensual salsa',
	coverageLabel: 'Vigente', entitlementId: 20, entitlementType: 'monthly_plan',
	hoursRemaining: null, classesRemaining: null, currentStatus: null, canRegisterAttendance: true
};
export const fullPassStudent: EligibleFullPassStudent = {
	studentId: 2, fullName: 'Luis López', phone: '5512345678', entitlementId: 21,
	hoursRemaining: 2, planName: 'Pase 12 horas'
};
