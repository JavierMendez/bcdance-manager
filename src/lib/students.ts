import { APP_LOCALE, getCalendarDateInAppTimezone } from '$lib/locale.js';
import { extractPhoneDigits, formatPhone, normalizePhone } from '$lib/phone.js';

export type SerializedStudent = {
	id: number;
	guid: string;
	fullName: string;
	phone: string | null;
	enrolledAt: string;
	active: boolean;
	paymentStatus: import('$lib/payments.js').PaymentStatus;
};

export function validateStudentInput(data: {
	fullName: string;
	phone: string;
	enrolledAt?: string;
}) {
	const errors: Record<string, string> = {};
	const fullName = data.fullName.trim();
	const phoneDigits = extractPhoneDigits(data.phone);
	const phone = phoneDigits ? normalizePhone(data.phone) : null;
	const enrolledAt = (data.enrolledAt ?? getCalendarDateInAppTimezone()).trim();

	if (!fullName) {
		errors.fullName = 'El nombre completo es obligatorio.';
	}

	if (phoneDigits && !phone) {
		errors.phone = 'El teléfono debe tener 10 dígitos.';
	}

	if (!enrolledAt) {
		errors.enrolledAt = 'La fecha de inscripción es obligatoria.';
	}

	return {
		errors,
		values: { fullName, phone, enrolledAt },
		parsed:
			Object.keys(errors).length === 0
				? {
						fullName,
						phone,
						enrolledAt: new Date(`${enrolledAt}T12:00:00.000Z`)
					}
				: null
	};
}

export function toStudentFormValues(
	student?: Pick<SerializedStudent, 'fullName' | 'phone' | 'enrolledAt'> | null
) {
	return {
		fullName: student?.fullName ?? '',
		phone: extractPhoneDigits(student?.phone ?? ''),
		enrolledAt: student?.enrolledAt
			? getCalendarDateInAppTimezone(new Date(student.enrolledAt))
			: getCalendarDateInAppTimezone()
	};
}

export { formatPhone };

export function formatEnrollmentDate(isoDate: string) {
	return new Intl.DateTimeFormat(APP_LOCALE, {
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	}).format(new Date(isoDate));
}
