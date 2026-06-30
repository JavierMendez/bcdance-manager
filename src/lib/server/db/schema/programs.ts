import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const programs = pgTable('programs', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export type Program = typeof programs.$inferSelect;
export type NewProgram = typeof programs.$inferInsert;
