import {
	getEffectiveFullPassHours,
	isFullPassEntitlementVigente,
	isFullPassExpiringSoon,
	resolvePaymentStatus,
	type EntitlementSnapshot,
	type PaymentStatus
} from '$lib/payments.js';

export type StudentAttentionItem = {
	id: number;
	fullName: string;
	phone: string | null;
	paymentStatus: PaymentStatus;
	planName: string;
	daysRemaining: number;
};

export type FullPassAttentionItem = {
	id: number;
	fullName: string;
	phone: string | null;
	paymentStatus: 'por_vencer';
	planName: string;
	hoursRemaining: number;
};

type EntitlementWithPlan = EntitlementSnapshot & {
	planName: string;
	hoursIncluded: number | null;
};

export function formatDaysUntilExpiry(days: number) {
	if (days <= 0) {
		return 'Vence hoy';
	}

	if (days === 1) {
		return 'Vence en 1 día';
	}

	return `Vence en ${days} días`;
}

export function formatHoursUntilExpiry(hours: number) {
	if (hours <= 0) {
		return 'Sin horas restantes';
	}

	if (hours === 1) {
		return 'Queda 1 hora';
	}

	return `Quedan ${hours} horas`;
}

export function buildExpiringFullPassStudents(
	students: { id: number; fullName: string; phone: string | null; active: boolean }[],
	entitlementsByStudent: Map<number, EntitlementWithPlan[]>,
	now = new Date(),
	limit = 5
) {
	const expiring: FullPassAttentionItem[] = [];

	for (const student of students) {
		if (!student.active) {
			continue;
		}

		const entitlements = entitlementsByStudent.get(student.id) ?? [];
		const fullPass = entitlements
			.filter((entry) => {
				if (!entry.active || entry.entitlementType !== 'full_pass') {
					return false;
				}

				const hoursRemaining = getEffectiveFullPassHours(
					entry.hoursRemaining,
					entry.startsAt,
					entry.endsAt,
					now
				);

				return (
					isFullPassEntitlementVigente(
						entry.hoursRemaining,
						entry.startsAt,
						entry.endsAt,
						now
					) && isFullPassExpiringSoon(hoursRemaining, entry.hoursIncluded)
				);
			})
			.sort(
				(a, b) =>
					getEffectiveFullPassHours(a.hoursRemaining, a.startsAt, a.endsAt, now) -
					getEffectiveFullPassHours(b.hoursRemaining, b.startsAt, b.endsAt, now)
			)[0];

		if (!fullPass) {
			continue;
		}

		expiring.push({
			id: student.id,
			fullName: student.fullName,
			phone: student.phone,
			paymentStatus: 'por_vencer',
			planName: fullPass.planName,
			hoursRemaining: getEffectiveFullPassHours(
				fullPass.hoursRemaining,
				fullPass.startsAt,
				fullPass.endsAt,
				now
			)
		});
	}

	expiring.sort((a, b) => a.hoursRemaining - b.hoursRemaining);

	return {
		items: expiring.slice(0, limit),
		total: expiring.length
	};
}

export function buildExpiringPaymentStudents(
	students: { id: number; fullName: string; phone: string | null; active: boolean }[],
	entitlementsByStudent: Map<number, EntitlementWithPlan[]>,
	now = new Date(),
	limit = 5
) {
	const expiring: StudentAttentionItem[] = [];

	for (const student of students) {
		if (!student.active) {
			continue;
		}

		const entitlements = entitlementsByStudent.get(student.id) ?? [];
		const paymentStatus = resolvePaymentStatus(entitlements, now);

		if (paymentStatus !== 'por_vencer') {
			continue;
		}

		const monthly = entitlements
			.filter((entry) => entry.active && entry.entitlementType === 'monthly_plan' && entry.endsAt)
			.sort((a, b) => b.endsAt!.getTime() - a.endsAt!.getTime())[0];

		if (!monthly?.endsAt) {
			continue;
		}

		const daysRemaining = Math.ceil(
			(monthly.endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
		);

		expiring.push({
			id: student.id,
			fullName: student.fullName,
			phone: student.phone,
			paymentStatus: 'por_vencer',
			planName: monthly.planName,
			daysRemaining
		});
	}

	expiring.sort((a, b) => a.daysRemaining - b.daysRemaining);

	return {
		items: expiring.slice(0, limit),
		total: expiring.length
	};
}

export type TodayClassItem = {
	id: number;
	name: string;
	schedule: string;
	enrolledCount: number;
};
