import { APP_LOCALE } from '$lib/locale.js';

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

export type ClassScheduleFormValues = {
	schedule: string;
	days: Weekday[];
	startDate: string;
	endDate: string;
	isActive?: boolean;
};

/** @deprecated Use ClassScheduleFormValues for new code */
export type CourseFormValues = ClassScheduleFormValues & {
	name: string;
	description: string;
};

export function validateClassScheduleInput(data: ClassScheduleFormValues) {
	const errors: Record<string, string> = {};
	const schedule = data.schedule.trim();
	const days = data.days.filter((day): day is Weekday => WEEKDAYS.includes(day as Weekday));
	const startDate = data.startDate.trim();
	const endDate = data.endDate.trim();

	if (!schedule) {
		errors.schedule = 'El horario es obligatorio.';
	}

	if (days.length === 0) {
		errors.days = 'Selecciona al menos un día.';
	}

	if (startDate && endDate && startDate > endDate) {
		errors.endDate = 'La fecha de término debe ser posterior a la de inicio.';
	}

	return {
		errors,
		values: {
			schedule,
			days,
			startDate,
			endDate,
			isActive: data.isActive !== false
		}
	};
}

export function parseIsActiveFormValue(value: FormDataEntryValue | null, fallback = true) {
	if (value === null || value === '') {
		return fallback;
	}

	return String(value) === 'true';
}

export function parseOptionalDate(value: string) {
	const trimmed = value.trim();
	return trimmed === '' ? null : trimmed;
}

/** @deprecated Use validateProgramInput + validateClassScheduleInput */
export function validateCourseInput(data: CourseFormValues) {
	const programErrors: Record<string, string> = {};
	const name = data.name.trim();
	const description = data.description.trim();

	if (!name) {
		programErrors.name = 'El nombre es obligatorio.';
	}

	if (!description) {
		programErrors.description = 'La descripción es obligatoria.';
	}

	const { errors: scheduleErrors, values: scheduleValues } = validateClassScheduleInput(data);

	return {
		errors: { ...programErrors, ...scheduleErrors },
		values: { name, description, ...scheduleValues }
	};
}

export function formatCourseDate(dateValue: string) {
	const [year, month, day] = dateValue.split('-').map(Number);
	return new Intl.DateTimeFormat(APP_LOCALE, {
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	}).format(new Date(year, month - 1, day));
}

export function formatCourseDays(days: string[]) {
	return days.join(', ');
}

export type { SerializedClassGroup, SerializedClassGroup as SerializedCourse } from '$lib/groups.js';
