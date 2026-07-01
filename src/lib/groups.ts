import { formatCourseDate, formatCourseDays, type Weekday } from '$lib/courses.js';
import { APP_LOCALE } from '$lib/locale.js';
import {
	PAYMENT_EXPIRING_SOON_DAYS,
	PAYMENT_STATUS_LABELS,
	DROP_IN_GUEST_LABEL,
	type PaymentStatus
} from '$lib/payments.js';

export type SerializedClassGroup = {
	id: number;
	programId: number;
	name: string;
	description: string;
	schedule: string;
	days: Weekday[];
	startDate: string;
	endDate: string;
};

/** @deprecated Use SerializedClassGroup */
export type SerializedCourse = SerializedClassGroup;

export type GroupMember = {
	studentId: number;
	fullName: string;
	phone: string;
	studentActive: boolean;
	modalityLabel: string;
	planName: string;
	coverageLabel: string;
	paymentStatus: PaymentStatus;
};

export type ClassDropInPayment = {
	paymentId: number;
	studentName: string;
	planName: string;
	totalAmount: number;
	paymentMethod: string;
	paidAtLabel: string;
};

/** @deprecated Use ClassDropInPayment */
export type CourseDropInPayment = ClassDropInPayment;

export type ClassGroup = SerializedClassGroup & {
	active: boolean;
	enrolledCount: number;
	dropInCount: number;
	members: GroupMember[];
	dropInPayments: ClassDropInPayment[];
};

/** @deprecated Use ClassGroup */
export type CourseGroup = ClassGroup;

export type GroupsPageData = {
	groups: ClassGroup[];
	activeClassCount: number;
	totalEnrollments: number;
};

type EntitlementRow = {
	entitlementType: string;
	groupId: number | null;
	endsAt: Date | null;
	hoursRemaining: number | null;
	classesRemaining: number | null;
	planName: string;
	student: {
		id: number;
		fullName: string;
		phone: string;
		active: boolean;
	};
};

export function isClassActive(
	classGroup: Pick<SerializedClassGroup, 'startDate' | 'endDate'>,
	now = new Date()
) {
	const today = now.toISOString().slice(0, 10);
	return classGroup.startDate <= today && today <= classGroup.endDate;
}

/** @deprecated Use isClassActive */
export const isCourseActive = isClassActive;

export function resolveEntitlementStatus(
	entitlementType: string,
	endsAt: Date | null,
	hoursRemaining: number | null,
	classesRemaining: number | null = null,
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

	if (entitlementType === 'drop_in') {
		return (classesRemaining ?? 0) > 0 ? 'vigente' : 'vencido';
	}

	return (hoursRemaining ?? 0) > 0 ? 'vigente' : 'vencido';
}

export function formatMonthlyCoverage(endsAt: Date | null) {
	if (!endsAt) {
		return 'Sin vigencia';
	}

	return `Vence el ${new Intl.DateTimeFormat(APP_LOCALE, {
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	}).format(endsAt)}`;
}

export function formatFullPassCoverage(hoursRemaining: number | null) {
	const hours = hoursRemaining ?? 0;
	return `${hours} h restante${hours === 1 ? '' : 's'}`;
}

export function formatDropInCoverage(classesRemaining: number | null) {
	const classes = classesRemaining ?? 0;
	return `${classes} clase${classes === 1 ? '' : 's'} restante${classes === 1 ? '' : 's'}`;
}

function buildMemberFromEntitlements(
	student: EntitlementRow['student'],
	monthly: EntitlementRow | null,
	fullPass: EntitlementRow | null,
	dropIn: EntitlementRow | null,
	now: Date
): GroupMember | null {
	if (!monthly && !fullPass && !dropIn) {
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
			monthly.classesRemaining,
			now
		);
	}

	if (dropIn) {
		modalityParts.push('Por clase');
		planParts.push(dropIn.planName);
		coverageParts.push(formatDropInCoverage(dropIn.classesRemaining));

		const dropInStatus = resolveEntitlementStatus(
			dropIn.entitlementType,
			dropIn.endsAt,
			dropIn.hoursRemaining,
			dropIn.classesRemaining,
			now
		);

		if (dropInStatus === 'vencido' || paymentStatus === 'vencido') {
			paymentStatus = 'vencido';
		} else if (dropInStatus === 'por_vencer' || paymentStatus === 'por_vencer') {
			paymentStatus = 'por_vencer';
		}
	}

	if (fullPass) {
		modalityParts.push('Full pass');
		planParts.push(fullPass.planName);
		coverageParts.push(formatFullPassCoverage(fullPass.hoursRemaining));

		const fullPassStatus = resolveEntitlementStatus(
			fullPass.entitlementType,
			fullPass.endsAt,
			fullPass.hoursRemaining,
			fullPass.classesRemaining,
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
		studentActive: student.active,
		modalityLabel: modalityParts.join(' + '),
		planName: planParts.join(' · '),
		coverageLabel: coverageParts.join(' · '),
		paymentStatus
	};
}

export function buildClassGroups(
	classes: SerializedClassGroup[],
	entitlements: EntitlementRow[],
	now = new Date()
): ClassGroup[] {
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

	return classes.map((classGroup) => {
		const membersByStudent = new Map<number, GroupMember>();

		for (const row of entitlements) {
			if (row.entitlementType !== 'monthly_plan' || row.groupId !== classGroup.id) {
				continue;
			}

			const fullPass = activeFullPassByStudent.get(row.student.id) ?? null;
			const member = buildMemberFromEntitlements(row.student, row, fullPass, null, now);

			if (member) {
				membersByStudent.set(row.student.id, member);
			}
		}

		for (const row of entitlements) {
			if (row.entitlementType !== 'drop_in' || row.groupId !== classGroup.id) {
				continue;
			}

			if ((row.classesRemaining ?? 0) <= 0) {
				continue;
			}

			if (membersByStudent.has(row.student.id)) {
				const existing = membersByStudent.get(row.student.id)!;
				const dropInMember = buildMemberFromEntitlements(row.student, null, null, row, now);

				if (dropInMember) {
					membersByStudent.set(row.student.id, {
						...existing,
						modalityLabel: `${existing.modalityLabel} + ${dropInMember.modalityLabel}`,
						planName: `${existing.planName} · ${dropInMember.planName}`,
						coverageLabel: `${existing.coverageLabel} · ${dropInMember.coverageLabel}`,
						paymentStatus:
							existing.paymentStatus === 'vencido' || dropInMember.paymentStatus === 'vencido'
								? 'vencido'
								: existing.paymentStatus === 'por_vencer' ||
									  dropInMember.paymentStatus === 'por_vencer'
									? 'por_vencer'
									: 'vigente'
					});
				}
				continue;
			}

			const fullPass = activeFullPassByStudent.get(row.student.id) ?? null;
			const member = buildMemberFromEntitlements(row.student, null, fullPass, row, now);

			if (member) {
				membersByStudent.set(row.student.id, member);
			}
		}

		if (isClassActive(classGroup, now)) {
			for (const [studentId, fullPassRow] of activeFullPassByStudent) {
				if (membersByStudent.has(studentId)) {
					continue;
				}

				const member = buildMemberFromEntitlements(fullPassRow.student, null, fullPassRow, null, now);

				if (member) {
					membersByStudent.set(studentId, member);
				}
			}
		}

		const members = [...membersByStudent.values()].sort((a, b) =>
			a.fullName.localeCompare(b.fullName, 'es')
		);

		const dropInCount = members.filter((member) => member.modalityLabel.includes('Por clase')).length;

		return {
			...classGroup,
			active: isClassActive(classGroup, now),
			enrolledCount: members.length,
			dropInCount,
			members,
			dropInPayments: []
		};
	});
}

/** @deprecated Use buildClassGroups */
export const buildCourseGroups = buildClassGroups;

export function formatClassMeta(classGroup: Pick<ClassGroup, 'days' | 'startDate' | 'endDate'>) {
	return `${formatCourseDays(classGroup.days)} · ${formatCourseDate(classGroup.startDate)} – ${formatCourseDate(classGroup.endDate)}`;
}

/** @deprecated Use formatClassMeta */
export const formatGroupCourseMeta = formatClassMeta;

export function getPaymentStatusLabel(status: PaymentStatus) {
	return PAYMENT_STATUS_LABELS[status];
}

export function attachDropInPaymentsToGroups(
	groups: ClassGroup[],
	paymentRows: {
		groupId: number | null;
		paymentId: number;
		studentName: string | null;
		planName: string;
		totalAmount: number;
		paymentMethod: string;
		paidAt: Date;
	}[]
): ClassGroup[] {
	const paymentsByGroup = new Map<number, ClassDropInPayment[]>();

	for (const row of paymentRows) {
		if (!row.groupId) {
			continue;
		}

		const payment: ClassDropInPayment = {
			paymentId: row.paymentId,
			studentName: row.studentName ?? DROP_IN_GUEST_LABEL,
			planName: row.planName,
			totalAmount: row.totalAmount,
			paymentMethod: row.paymentMethod,
			paidAtLabel: new Intl.DateTimeFormat(APP_LOCALE, {
				day: '2-digit',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				timeZone: 'America/Mexico_City'
			}).format(row.paidAt)
		};

		const existing = paymentsByGroup.get(row.groupId) ?? [];
		existing.push(payment);
		paymentsByGroup.set(row.groupId, existing);
	}

	return groups.map((group) => ({
		...group,
		dropInPayments: paymentsByGroup.get(group.id) ?? []
	}));
}

export function getEnrolledStudentIdsForClass(
	classGroup: Pick<SerializedClassGroup, 'id' | 'startDate' | 'endDate'>,
	entitlements: EntitlementRow[],
	now = new Date()
): number[] {
	const placeholder: SerializedClassGroup = {
		id: classGroup.id,
		programId: 0,
		name: '',
		description: '',
		schedule: '',
		days: [],
		startDate: classGroup.startDate,
		endDate: classGroup.endDate
	};

	const [built] = buildClassGroups([placeholder], entitlements, now);
	return built.members.map((member) => member.studentId);
}

export type { Weekday };
