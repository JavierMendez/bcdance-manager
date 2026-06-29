import { formatFullPassCoverage } from '$lib/groups.js';

export const ATTENDANCE_STATUSES = ['attended', 'absent'] as const;
export const FULL_PASS_HOURS_PER_CLASS = 1;

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
	entitlementType: 'monthly_plan' | 'full_pass';
	hoursRemaining: number | null;
	currentStatus: AttendanceStatus | null;
};

type EntitlementSnapshot = {
	id: number;
	entitlementType: string;
	courseId: number | null;
	endsAt: Date | null;
	hoursRemaining: number | null;
	planName: string;
	student: {
		id: number;
		fullName: string;
		active: boolean;
	};
};

export function getTodaySessionDate(now = new Date()) {
	return now.toISOString().slice(0, 10);
}

export function formatSessionDate(dateValue: string) {
	const [year, month, day] = dateValue.split('-').map(Number);
	return new Intl.DateTimeFormat('es-CL', {
		weekday: 'long',
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	}).format(new Date(year, month - 1, day));
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

export function resolveAttendanceEntitlement(
	courseId: number,
	monthly: EntitlementSnapshot | null,
	fullPass: EntitlementSnapshot | null
): EntitlementSnapshot | null {
	if (monthly?.courseId === courseId) {
		return monthly;
	}

	if (fullPass && (fullPass.hoursRemaining ?? 0) > 0) {
		return fullPass;
	}

	return null;
}

export function buildAttendanceMembers(
	courseId: number,
	entitlements: EntitlementSnapshot[],
	attendanceByStudent: Map<number, AttendanceStatus>,
	_now = new Date()
): AttendanceMember[] {
	const monthlyByStudent = new Map<number, EntitlementSnapshot>();
	const fullPassByStudent = new Map<number, EntitlementSnapshot>();

	for (const row of entitlements) {
		if (row.entitlementType === 'monthly_plan' && row.courseId === courseId) {
			monthlyByStudent.set(row.student.id, row);
		}

		if (row.entitlementType === 'full_pass' && (row.hoursRemaining ?? 0) > 0) {
			fullPassByStudent.set(row.student.id, row);
		}
	}

	const studentIds = new Set<number>([
		...monthlyByStudent.keys(),
		...fullPassByStudent.keys()
	]);

	const members: AttendanceMember[] = [];

	for (const studentId of studentIds) {
		const entitlement = resolveAttendanceEntitlement(
			courseId,
			monthlyByStudent.get(studentId) ?? null,
			fullPassByStudent.get(studentId) ?? null
		);

		if (!entitlement || !entitlement.student.active) {
			continue;
		}

		const isMonthly = entitlement.entitlementType === 'monthly_plan';

		members.push({
			studentId,
			fullName: entitlement.student.fullName,
			modalityLabel: isMonthly ? 'Plan mensual' : 'Full pass',
			planName: entitlement.planName,
			coverageLabel: isMonthly
				? entitlement.endsAt
					? `Vence el ${new Intl.DateTimeFormat('es-CL', {
							day: '2-digit',
							month: 'long',
							year: 'numeric'
						}).format(entitlement.endsAt)}`
					: 'Sin vigencia'
				: formatFullPassCoverage(entitlement.hoursRemaining),
			entitlementId: entitlement.id,
			entitlementType: isMonthly ? 'monthly_plan' : 'full_pass',
			hoursRemaining: entitlement.hoursRemaining,
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
