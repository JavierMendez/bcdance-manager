import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { groups, programs } from '$lib/server/db/schema/index.js';
import type { PageServerLoad } from './$types.js';

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
