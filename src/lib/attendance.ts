import { formatDropInCoverage, formatFullPassCoverage } from '$lib/groups.js';
import { APP_LOCALE, getCalendarDateInAppTimezone } from '$lib/locale.js';
import { DROP_IN_GUEST_LABEL } from '$lib/payments.js';

export const ATTENDANCE_STATUSES = ['attended', 'absent'] as const;
export const FULL_PASS_HOURS_PER_CLASS = 1;
export const DROP_IN_CLASSES_PER_SESSION = 1;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
	attended: 'Asistió',
	absent: 'Falta'
};

export type AttendanceEntryInput = {
	studentId: number;
	entitlementId: number;
	status: AttendanceStatus;
};

export type AttendanceMember = {
	studentId: number;
	fullName: string;
	modalityLabel: string;
	planName: string;
	coverageLabel: string;
	entitlementId: number;
	entitlementType: 'monthly_plan' | 'full_pass' | 'drop_in';
	hoursRemaining: number | null;
	classesRemaining: number | null;
	currentStatus: AttendanceStatus | null;
};

export type EligibleFullPassStudent = {
	studentId: number;
	fullName: string;
	phone: string | null;
	entitlementId: number;
	hoursRemaining: number;
	planName: string;
};

type EntitlementSnapshot = {
	id: number;
	entitlementType: string;
	groupId: number | null;
	endsAt: Date | null;
	hoursRemaining: number | null;
	classesRemaining: number | null;
	planName: string;
	student: {
		id: number;
		fullName: string;
		phone?: string | null;
		active: boolean;
	};
};

export function getTodaySessionDate(now = new Date()) {
	return getCalendarDateInAppTimezone(now);
}

export function formatSessionDate(dateValue: string) {
	return new Intl.DateTimeFormat(APP_LOCALE, {
		weekday: 'long',
		day: '2-digit',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(new Date(`${dateValue}T12:00:00.000Z`));
}

export function parseAttendanceEntries(raw: string): {
	entries: AttendanceEntryInput[];
	errors: string[];
} {
	const errors: string[] = [];

	try {
		const parsed = JSON.parse(raw) as unknown;

		if (!Array.isArray(parsed)) {
			return { entries: [], errors: ['Formato de asistencia inválido.'] };
		}

		const entries: AttendanceEntryInput[] = [];

		for (const item of parsed) {
			if (typeof item !== 'object' || item === null) {
				errors.push('Entrada de asistencia inválida.');
				continue;
			}

			const studentId = Number((item as AttendanceEntryInput).studentId);
			const entitlementId = Number((item as AttendanceEntryInput).entitlementId);
			const status = (item as AttendanceEntryInput).status;

			if (!studentId || !entitlementId) {
				errors.push('Falta identificar al alumno o la vigencia.');
				continue;
			}

			if (!ATTENDANCE_STATUSES.includes(status)) {
				errors.push(`Estado inválido para el alumno ${studentId}.`);
				continue;
			}

			entries.push({ studentId, entitlementId, status });
		}

		return { entries, errors };
	} catch {
		return { entries: [], errors: ['No se pudo leer la asistencia enviada.'] };
	}
}

export function isMonthlyEntitlementVigente(endsAt: Date | null, now = new Date()) {
	return !!endsAt && endsAt > now;
}

export function toFullPassAttendanceMember(
	student: EligibleFullPassStudent,
	currentStatus: AttendanceStatus | null = null
): AttendanceMember {
	return {
		studentId: student.studentId,
		fullName: student.fullName,
		modalityLabel: 'Full pass',
		planName: student.planName,
		coverageLabel: formatFullPassCoverage(student.hoursRemaining),
		entitlementId: student.entitlementId,
		entitlementType: 'full_pass',
		hoursRemaining: student.hoursRemaining,
		classesRemaining: null,
		currentStatus
	};
}

export function buildEligibleFullPassStudents(
	groupId: number,
	entitlements: EntitlementSnapshot[],
	excludedStudentIds: Set<number>,
	now = new Date()
): EligibleFullPassStudent[] {
	const monthlyStudentIds = new Set<number>();

	for (const row of entitlements) {
		if (
			row.entitlementType === 'monthly_plan' &&
			row.groupId === groupId &&
			isMonthlyEntitlementVigente(row.endsAt, now)
		) {
			monthlyStudentIds.add(row.student.id);
		}
	}

	const eligible: EligibleFullPassStudent[] = [];

	for (const row of entitlements) {
		if (row.entitlementType !== 'full_pass') {
			continue;
		}

		if (!row.student.active) {
			continue;
		}

		if ((row.hoursRemaining ?? 0) <= 0) {
			continue;
		}

		if (monthlyStudentIds.has(row.student.id)) {
			continue;
		}

		if (excludedStudentIds.has(row.student.id)) {
			continue;
		}

		eligible.push({
			studentId: row.student.id,
			fullName: row.student.fullName,
			phone: row.student.phone ?? null,
			entitlementId: row.id,
			hoursRemaining: row.hoursRemaining ?? 0,
			planName: row.planName
		});
	}

	return eligible.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
}

export function resolveAttendanceEntitlement(
	groupId: number,
	monthly: EntitlementSnapshot | null,
	dropIn: EntitlementSnapshot | null,
	fullPass: EntitlementSnapshot | null,
	hasSessionAttendance = false
): EntitlementSnapshot | null {
	if (monthly?.groupId === groupId) {
		return monthly;
	}

	if (
		dropIn?.groupId === groupId &&
		((dropIn.classesRemaining ?? 0) > 0 || hasSessionAttendance)
	) {
		return dropIn;
	}

	if (fullPass && (fullPass.hoursRemaining ?? 0) > 0) {
		return fullPass;
	}

	return null;
}

export function buildAttendanceMembers(
	groupId: number,
	entitlements: EntitlementSnapshot[],
	attendanceByStudent: Map<number, AttendanceStatus>,
	_now = new Date()
): AttendanceMember[] {
	const monthlyByStudent = new Map<number, EntitlementSnapshot>();
	const dropInByStudent = new Map<number, EntitlementSnapshot>();
	const fullPassByStudent = new Map<number, EntitlementSnapshot>();

	for (const row of entitlements) {
		if (
			row.entitlementType === 'monthly_plan' &&
			row.groupId === groupId &&
			isMonthlyEntitlementVigente(row.endsAt, _now)
		) {
			monthlyByStudent.set(row.student.id, row);
		}

		if (
			row.entitlementType === 'drop_in' &&
			row.groupId === groupId &&
			((row.classesRemaining ?? 0) > 0 || attendanceByStudent.has(row.student.id))
		) {
			dropInByStudent.set(row.student.id, row);
		}

		if (row.entitlementType === 'full_pass') {
			fullPassByStudent.set(row.student.id, row);
		}
	}

	const studentIds = new Set<number>([
		...monthlyByStudent.keys(),
		...dropInByStudent.keys(),
		...fullPassByStudent.keys().filter((studentId) => attendanceByStudent.has(studentId))
	]);

	const members: AttendanceMember[] = [];

	for (const studentId of studentIds) {
		const hasSessionAttendance = attendanceByStudent.has(studentId);
		const entitlement = resolveAttendanceEntitlement(
			groupId,
			monthlyByStudent.get(studentId) ?? null,
			dropInByStudent.get(studentId) ?? null,
			fullPassByStudent.get(studentId) ?? null,
			hasSessionAttendance
		);

		if (!entitlement || !entitlement.student.active) {
			continue;
		}

		const isMonthly = entitlement.entitlementType === 'monthly_plan';
		const isDropIn = entitlement.entitlementType === 'drop_in';

		members.push({
			studentId,
			fullName: entitlement.student.fullName,
			modalityLabel: isMonthly ? 'Plan mensual' : isDropIn ? 'Por clase' : 'Full pass',
			planName: entitlement.planName,
			coverageLabel: isMonthly
				? entitlement.endsAt
					? `Vence el ${new Intl.DateTimeFormat(APP_LOCALE, {
							day: '2-digit',
							month: 'long',
							year: 'numeric'
						}).format(entitlement.endsAt)}`
					: 'Sin vigencia'
				: isDropIn
					? formatDropInCoverage(entitlement.classesRemaining)
					: formatFullPassCoverage(entitlement.hoursRemaining),
			entitlementId: entitlement.id,
			entitlementType: isMonthly ? 'monthly_plan' : isDropIn ? 'drop_in' : 'full_pass',
			hoursRemaining: entitlement.hoursRemaining,
			classesRemaining: entitlement.classesRemaining,
			currentStatus: attendanceByStudent.get(studentId) ?? null
		});
	}

	return members.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
}

export function getAttendanceStatusBadgeVariant(
	status: AttendanceStatus
): 'default' | 'secondary' | 'destructive' {
	switch (status) {
		case 'attended':
			return 'default';
		case 'absent':
			return 'destructive';
	}
}

export type SessionDropInPayment = {
	paymentId: number;
	studentId: number | null;
	studentName: string;
	planName: string;
	totalAmount: number;
	discountPercent: number;
	paymentMethod: string;
	classesGranted: number;
	attendanceStatus: AttendanceStatus | null;
};

export function buildSessionDropInPayments(
	rows: {
		paymentId: number;
		studentId: number | null;
		studentName: string | null;
		planName: string;
		totalAmount: number;
		discountPercent: number;
		paymentMethod: string;
		classesGranted: number | null;
	}[],
	attendanceByStudent: Map<number, AttendanceStatus>
): SessionDropInPayment[] {
	return rows
		.map((row) => ({
			paymentId: row.paymentId,
			studentId: row.studentId,
			studentName: row.studentName ?? DROP_IN_GUEST_LABEL,
			planName: row.planName,
			totalAmount: row.totalAmount,
			discountPercent: row.discountPercent,
			paymentMethod: row.paymentMethod,
			classesGranted: row.classesGranted ?? 1,
			attendanceStatus: row.studentId
				? (attendanceByStudent.get(row.studentId) ?? null)
				: null
		}))
		.sort((a, b) => a.studentName.localeCompare(b.studentName, 'es'));
}
