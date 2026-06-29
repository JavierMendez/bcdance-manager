export const WEEKDAYS = [
	'Lunes',
	'Martes',
	'Miércoles',
	'Jueves',
	'Viernes',
	'Sábado',
	'Domingo'
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type SerializedCourse = {
	id: number;
	name: string;
	description: string;
	schedule: string;
	days: Weekday[];
	startDate: string;
	endDate: string;
};

export type CourseFormValues = {
	name: string;
	description: string;
	schedule: string;
	days: Weekday[];
	startDate: string;
	endDate: string;
};

export function validateCourseInput(data: CourseFormValues) {
	const errors: Record<string, string> = {};
	const name = data.name.trim();
	const description = data.description.trim();
	const schedule = data.schedule.trim();
	const days = data.days.filter((day): day is Weekday =>
		WEEKDAYS.includes(day as Weekday)
	);
	const startDate = data.startDate.trim();
	const endDate = data.endDate.trim();

	if (!name) {
		errors.name = 'El nombre es obligatorio.';
	}

	if (!description) {
		errors.description = 'La descripción es obligatoria.';
	}

	if (!schedule) {
		errors.schedule = 'El horario es obligatorio.';
	}

	if (days.length === 0) {
		errors.days = 'Selecciona al menos un día.';
	}

	if (!startDate) {
		errors.startDate = 'La fecha de inicio es obligatoria.';
	}

	if (!endDate) {
		errors.endDate = 'La fecha de término es obligatoria.';
	}

	if (startDate && endDate && startDate > endDate) {
		errors.endDate = 'La fecha de término debe ser posterior a la de inicio.';
	}

	return {
		errors,
		values: { name, description, schedule, days, startDate, endDate }
	};
}

export function formatCourseDate(dateValue: string) {
	const [year, month, day] = dateValue.split('-').map(Number);
	return new Intl.DateTimeFormat('es-CL', {
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	}).format(new Date(year, month - 1, day));
}

export function formatCourseDays(days: string[]) {
	return days.join(', ');
}
