import { fail } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { studentEntitlements, students } from '$lib/server/db/schema/index.js';
import { resolvePaymentStatus } from '$lib/payments.js';
import { validateStudentInput, type SerializedStudent } from '$lib/students.js';
import type { Actions, PageServerLoad } from './$types.js';

function serializeStudent(
	student: typeof students.$inferSelect,
	paymentStatus: SerializedStudent['paymentStatus']
): SerializedStudent {
	return {
		id: student.id,
		guid: student.guid,
		fullName: student.fullName,
		phone: student.phone,
		enrolledAt: student.enrolledAt.toISOString(),
		active: student.active,
		paymentStatus
	};
}

async function getPaymentStatusForStudent(
	db: ReturnType<typeof getDb>,
	studentId: number
): Promise<SerializedStudent['paymentStatus']> {
	const entitlements = await db
		.select()
		.from(studentEntitlements)
		.where(
			and(eq(studentEntitlements.studentId, studentId), eq(studentEntitlements.active, true))
		);

	return resolvePaymentStatus(entitlements);
}

export const load: PageServerLoad = async () => {
	const db = getDb();
	const [rows, entitlementRows] = await Promise.all([
		db.select().from(students).orderBy(desc(students.enrolledAt)),
		db.select().from(studentEntitlements).where(eq(studentEntitlements.active, true))
	]);

	const entitlementsByStudent = new Map<number, typeof entitlementRows>();
	for (const entitlement of entitlementRows) {
		const current = entitlementsByStudent.get(entitlement.studentId) ?? [];
		current.push(entitlement);
		entitlementsByStudent.set(entitlement.studentId, current);
	}

	return {
		students: rows.map((student) =>
			serializeStudent(
				student,
				resolvePaymentStatus(entitlementsByStudent.get(student.id) ?? [])
			)
		)
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();
		const { errors, values, parsed } = validateStudentInput({
			fullName: String(formData.get('fullName') ?? ''),
			phone: String(formData.get('phone') ?? ''),
			enrolledAt: String(formData.get('enrolledAt') ?? '')
		});

		if (Object.keys(errors).length > 0 || !parsed) {
			return fail(400, { errors, values, mode: 'create' as const });
		}

		const db = getDb();

		const [created] = await db
			.insert(students)
			.values({
				fullName: parsed.fullName,
				phone: parsed.phone,
				enrolledAt: parsed.enrolledAt,
				updatedAt: new Date()
			})
			.returning();

		return { success: true, mode: 'create' as const, student: serializeStudent(created, 'vencido') };
	},

	update: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));

		if (!id) {
			return fail(400, { message: 'Alumno no válido.' });
		}

		const { errors, values, parsed } = validateStudentInput({
			fullName: String(formData.get('fullName') ?? ''),
			phone: String(formData.get('phone') ?? ''),
			enrolledAt: String(formData.get('enrolledAt') ?? '')
		});

		if (Object.keys(errors).length > 0 || !parsed) {
			return fail(400, { errors, values, mode: 'edit' as const, id });
		}

		const db = getDb();

		const [updated] = await db
			.update(students)
			.set({
				fullName: parsed.fullName,
				phone: parsed.phone,
				enrolledAt: parsed.enrolledAt,
				updatedAt: new Date()
			})
			.where(eq(students.id, id))
			.returning();

		if (!updated) {
			return fail(404, { message: 'Alumno no encontrado.' });
		}

		return {
			success: true,
			mode: 'edit' as const,
			student: serializeStudent(updated, await getPaymentStatusForStudent(db, id))
		};
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

		return {
			success: true,
			student: serializeStudent(updated, await getPaymentStatusForStudent(db, id))
		};
	}
};
