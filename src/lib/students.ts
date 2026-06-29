export type SerializedStudent = {
	id: number;
	fullName: string;
	phone: string;
	email: string;
	enrolledAt: string;
	active: boolean;
	paymentStatus: import('$lib/payments.js').PaymentStatus;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStudentInput(data: {
	fullName: string;
	phone: string;
	email: string;
}) {
	const errors: Record<string, string> = {};
	const fullName = data.fullName.trim();
	const phone = data.phone.trim();
	const email = data.email.trim().toLowerCase();

	if (!fullName) {
		errors.fullName = 'El nombre completo es obligatorio.';
	}

	if (!phone) {
		errors.phone = 'El teléfono es obligatorio.';
	}

	if (!email) {
		errors.email = 'El correo electrónico es obligatorio.';
	} else if (!EMAIL_PATTERN.test(email)) {
		errors.email = 'El correo electrónico no es válido.';
	}

	return {
		errors,
		values: { fullName, phone, email }
	};
}

export function formatEnrollmentDate(isoDate: string) {
	return new Intl.DateTimeFormat('es-CL', {
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	}).format(new Date(isoDate));
}
