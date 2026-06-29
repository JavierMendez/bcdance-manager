import { formatCourseDate, formatCourseDays, type SerializedCourse, type Weekday } from '$lib/courses.js';
import {
	PAYMENT_EXPIRING_SOON_DAYS,
	PAYMENT_STATUS_LABELS,
	type PaymentStatus
} from '$lib/payments.js';

export type GroupMember = {
	studentId: number;
	fullName: string;
	phone: string;
	email: string;
	studentActive: boolean;
	modalityLabel: string;
	planName: string;
	coverageLabel: string;
	paymentStatus: PaymentStatus;
};

export type CourseGroup = SerializedCourse & {
	active: boolean;
	enrolledCount: number;
	members: GroupMember[];
};

export type GroupsPageData = {
	groups: CourseGroup[];
	activeCourseCount: number;
	totalEnrollments: number;
};

type EntitlementRow = {
	entitlementType: string;
	courseId: number | null;
	endsAt: Date | null;
	hoursRemaining: number | null;
	planName: string;
	student: {
		id: number;
		fullName: string;
		phone: string;
		email: string;
		active: boolean;
	};
};

export function isCourseActive(
	course: Pick<SerializedCourse, 'startDate' | 'endDate'>,
	now = new Date()
) {
	const today = now.toISOString().slice(0, 10);
	return course.startDate <= today && today <= course.endDate;
}

export function resolveEntitlementStatus(
	entitlementType: string,
	endsAt: Date | null,
	hoursRemaining: number | null,
	now = new Date()
): PaymentStatus {
	if (entitlementType === 'monthly_plan') {
		if (!endsAt || endsAt <= now) {
			return 'vencido';
		}

		const daysUntilExpiry =
			(endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

		if (daysUntilExpiry <= PAYMENT_EXPIRING_SOON_DAYS) {
			return 'por_vencer';
		}

		return 'vigente';
	}

	return (hoursRemaining ?? 0) > 0 ? 'vigente' : 'vencido';
}

export function formatMonthlyCoverage(endsAt: Date | null) {
	if (!endsAt) {
		return 'Sin vigencia';
	}

	return `Vence el ${new Intl.DateTimeFormat('es-CL', {
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	}).format(endsAt)}`;
}

export function formatFullPassCoverage(hoursRemaining: number | null) {
	const hours = hoursRemaining ?? 0;
	return `${hours} h restante${hours === 1 ? '' : 's'}`;
}

function buildMemberFromEntitlements(
	student: EntitlementRow['student'],
	monthly: EntitlementRow | null,
	fullPass: EntitlementRow | null,
	now: Date
): GroupMember | null {
	if (!monthly && !fullPass) {
		return null;
	}

	const modalityParts: string[] = [];
	const planParts: string[] = [];
	const coverageParts: string[] = [];
	let paymentStatus: PaymentStatus = 'vigente';

	if (monthly) {
		modalityParts.push('Plan mensual');
		planParts.push(monthly.planName);
		coverageParts.push(formatMonthlyCoverage(monthly.endsAt));
		paymentStatus = resolveEntitlementStatus(
			monthly.entitlementType,
			monthly.endsAt,
			monthly.hoursRemaining,
			now
		);
	}

	if (fullPass) {
		modalityParts.push('Full pass');
		planParts.push(fullPass.planName);
		coverageParts.push(formatFullPassCoverage(fullPass.hoursRemaining));

		const fullPassStatus = resolveEntitlementStatus(
			fullPass.entitlementType,
			fullPass.endsAt,
			fullPass.hoursRemaining,
			now
		);

		if (fullPassStatus === 'vencido' || paymentStatus === 'vencido') {
			paymentStatus = 'vencido';
		} else if (fullPassStatus === 'por_vencer' || paymentStatus === 'por_vencer') {
			paymentStatus = 'por_vencer';
		}
	}

	return {
		studentId: student.id,
		fullName: student.fullName,
		phone: student.phone,
		email: student.email,
		studentActive: student.active,
		modalityLabel: modalityParts.join(' + '),
		planName: planParts.join(' · '),
		coverageLabel: coverageParts.join(' · '),
		paymentStatus
	};
}

export function buildCourseGroups(
	courses: SerializedCourse[],
	entitlements: EntitlementRow[],
	now = new Date()
): CourseGroup[] {
	const activeFullPassByStudent = new Map<number, EntitlementRow>();

	for (const row of entitlements) {
		if (row.entitlementType !== 'full_pass') {
			continue;
		}

		if ((row.hoursRemaining ?? 0) <= 0) {
			continue;
		}

		activeFullPassByStudent.set(row.student.id, row);
	}

	return courses.map((course) => {
		const membersByStudent = new Map<number, GroupMember>();

		for (const row of entitlements) {
			if (row.entitlementType !== 'monthly_plan' || row.courseId !== course.id) {
				continue;
			}

			const fullPass = activeFullPassByStudent.get(row.student.id) ?? null;
			const member = buildMemberFromEntitlements(row.student, row, fullPass, now);

			if (member) {
				membersByStudent.set(row.student.id, member);
			}
		}

		if (isCourseActive(course, now)) {
			for (const [studentId, fullPassRow] of activeFullPassByStudent) {
				if (membersByStudent.has(studentId)) {
					continue;
				}

				const member = buildMemberFromEntitlements(fullPassRow.student, null, fullPassRow, now);

				if (member) {
					membersByStudent.set(studentId, member);
				}
			}
		}

		const members = [...membersByStudent.values()].sort((a, b) =>
			a.fullName.localeCompare(b.fullName, 'es')
		);

		return {
			...course,
			active: isCourseActive(course, now),
			enrolledCount: members.length,
			members
		};
	});
}

export function formatGroupCourseMeta(course: Pick<CourseGroup, 'days' | 'startDate' | 'endDate'>) {
	return `${formatCourseDays(course.days)} · ${formatCourseDate(course.startDate)} – ${formatCourseDate(course.endDate)}`;
}

export function getPaymentStatusLabel(status: PaymentStatus) {
	return PAYMENT_STATUS_LABELS[status];
}

export type { Weekday };
