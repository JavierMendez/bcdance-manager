import { fail } from '@sveltejs/kit';
import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { groups, programs } from '$lib/server/db/schema/index.js';
import {
	validateProgramInput,
	type SerializedProgram
} from '$lib/programs.js';
import type { Actions, PageServerLoad } from './$types.js';

function serializeProgram(program: typeof programs.$inferSelect): SerializedProgram {
	return {
		id: program.id,
		name: program.name,
		description: program.description
	};
}

function parseProgramForm(formData: FormData) {
	return validateProgramInput({
		name: String(formData.get('name') ?? ''),
		description: String(formData.get('description') ?? '')
	});
}

export const load: PageServerLoad = async () => {
	const db = getDb();

	const rows = await db
		.select({
			id: programs.id,
			name: programs.name,
			description: programs.description,
			classCount: sql<number>`count(${groups.id})::int`
		})
		.from(programs)
		.leftJoin(groups, eq(groups.programId, programs.id))
		.groupBy(programs.id, programs.name, programs.description, programs.createdAt)
		.orderBy(desc(programs.createdAt));

	return { programs: rows };
};

export const actions: Actions = {
	update: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const { errors, values } = parseProgramForm(formData);

		if (!id) {
			return fail(400, { message: 'Programa no válido.' });
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values, mode: 'edit' as const, id });
		}

		const db = getDb();

		const [updated] = await db
			.update(programs)
			.set({
				name: values.name,
				description: values.description,
				updatedAt: new Date()
			})
			.where(eq(programs.id, id))
			.returning();

		if (!updated) {
			return fail(404, { message: 'Programa no encontrado.' });
		}

		return {
			success: true,
			mode: 'edit' as const,
			program: serializeProgram(updated)
		};
	}
};
