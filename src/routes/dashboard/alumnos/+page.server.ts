import { fail } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { students } from '$lib/server/db/schema/index.js';
import { validateStudentInput, type SerializedStudent } from '$lib/students.js';
import type { Actions, PageServerLoad } from './$types.js';

function isUniqueViolation(error: unknown) {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		error.code === '23505'
	);
}

function serializeStudent(student: typeof students.$inferSelect): SerializedStudent {
	return {
		id: student.id,
		fullName: student.fullName,
		phone: student.phone,
		email: student.email,
		enrolledAt: student.enrolledAt.toISOString(),
		active: student.active
	};
}

export const load: PageServerLoad = async () => {
	const db = getDb();
	const rows = await db.select().from(students).orderBy(desc(students.enrolledAt));

	return {
		students: rows.map(serializeStudent)
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();
		const { errors, values } = validateStudentInput({
			fullName: String(formData.get('fullName') ?? ''),
			phone: String(formData.get('phone') ?? ''),
			email: String(formData.get('email') ?? '')
		});

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values, mode: 'create' as const });
		}

		const db = getDb();

		try {
			const [created] = await db
				.insert(students)
				.values({
					fullName: values.fullName,
					phone: values.phone,
					email: values.email,
					updatedAt: new Date()
				})
				.returning();

			return { success: true, mode: 'create' as const, student: serializeStudent(created) };
		} catch (error) {
			if (isUniqueViolation(error)) {
				return fail(400, {
					errors: { email: 'Ya existe un alumno con este correo electrónico.' },
					values,
					mode: 'create' as const
				});
			}

			throw error;
		}
	},

	update: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));

		if (!id) {
			return fail(400, { message: 'Alumno no válido.' });
		}

		const { errors, values } = validateStudentInput({
			fullName: String(formData.get('fullName') ?? ''),
			phone: String(formData.get('phone') ?? ''),
			email: String(formData.get('email') ?? '')
		});

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values, mode: 'edit' as const, id });
		}

		const db = getDb();

		try {
			const [updated] = await db
				.update(students)
				.set({
					fullName: values.fullName,
					phone: values.phone,
					email: values.email,
					updatedAt: new Date()
				})
				.where(eq(students.id, id))
				.returning();

			if (!updated) {
				return fail(404, { message: 'Alumno no encontrado.' });
			}

			return { success: true, mode: 'edit' as const, student: serializeStudent(updated) };
		} catch (error) {
			if (isUniqueViolation(error)) {
				return fail(400, {
					errors: { email: 'Ya existe un alumno con este correo electrónico.' },
					values,
					mode: 'edit' as const,
					id
				});
			}

			throw error;
		}
	},

	toggleActive: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const active = formData.get('active') === 'true';

		if (!id) {
			return fail(400, { message: 'Alumno no válido.' });
		}

		const db = getDb();

		const [updated] = await db
			.update(students)
			.set({ active, updatedAt: new Date() })
			.where(eq(students.id, id))
			.returning();

		if (!updated) {
			return fail(404, { message: 'Alumno no encontrado.' });
		}

		return { success: true, student: serializeStudent(updated) };
	}
};
