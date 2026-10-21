import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '../../../src/lib/server/db/schema/index.js';

// Never fall back to DATABASE_URL: migration and TRUNCATE must only reach our disposable DB.
export function integrationUrl() {
	const value = process.env.ATTENDANCE_INTEGRATION_DATABASE_URL;
	if (!value) throw new Error('ATTENDANCE_INTEGRATION_DATABASE_URL is required; use docker-compose.integration.yml.');
	const url = new URL(value);
	if (url.hostname !== 'balance-db' || url.pathname !== '/attendance_balance_test' || url.username !== 'balance_test' || !['postgres:', 'postgresql:'].includes(url.protocol) || url.search || (url.port && url.port !== '5432')) {
		throw new Error('Refusing integration database outside balance-db/attendance_balance_test (balance_test).');
	}
	return value;
}

export function connection() {
	const client = postgres(integrationUrl(), { max: 1, connection: { statement_timeout: 10000, lock_timeout: 8000 } });
	return { client, db: drizzle(client, { schema }) };
}

export async function prepareDatabase() {
	const connectionForMigration = connection();
	try {
		await migrate(connectionForMigration.db, { migrationsFolder: 'drizzle' });
	} finally {
		await connectionForMigration.client.end();
	}
}

export function gate() {
	let release!: () => void;
	const promise = new Promise<void>((resolve) => { release = resolve; });
	return { promise, release };
}

export async function deadline<T>(promise: Promise<T>, label: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Timeout: ${label}`)), 12000); })
		]);
	} finally {
		clearTimeout(timer);
	}
}

/** Pause after real entitlement SELECTs. Everything else, including transactions and locks,
 * is PostgreSQL/Drizzle. omitLock reproduces only the old missing FOR UPDATE protocol. */
export function observedDatabase(
	db: ReturnType<typeof connection>['db'],
	onRead: () => Promise<void>,
	omitLock = false
): typeof db {
	function queryProxy(builder: any, entitlement = false): any {
		return new Proxy(builder, {
			get(target, key) {
				if (key === 'then') return (resolve: any, reject: any) => Promise.resolve(target).then(async (rows) => {
					if (entitlement) await onRead();
					return rows;
				}).then(resolve, reject);
				const value = Reflect.get(target, key);
				if (typeof value !== 'function') return value;
				return (...args: any[]) => {
					if (key === 'for' && omitLock) return queryProxy(target, entitlement);
					const next = value.apply(target, args);
					return queryProxy(next, entitlement || (key === 'from' && args[0] === schema.studentEntitlements));
				};
			}
		});
	}
	return new Proxy(db, {
		get(target, key) {
			if (key === 'transaction') return (callback: (tx: any) => Promise<unknown>) => target.transaction((tx) => callback(new Proxy(tx, {
				get(transaction, member) {
					if (member === 'select') return (...args: any[]) => queryProxy((transaction.select as any)(...args));
					const value = Reflect.get(transaction, member);
					return typeof value === 'function' ? value.bind(transaction) : value;
				}
			})));
			const value = Reflect.get(target, key);
			return typeof value === 'function' ? value.bind(target) : value;
		}
	});
}
