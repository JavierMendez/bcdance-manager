import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { request } from 'playwright';
import postgres from 'postgres';
import { hashPassword } from 'better-auth/crypto';

// Refuse other databases even when invoked outside the dedicated Compose stack.
const database = new URL(process.env.DATABASE_URL);
assert.equal(database.hostname, 'auth-db');
assert.equal(database.pathname, '/dashboard_auth_test');
const sql = postgres(database.toString(), { max: 1 });
const baseURL = 'http://localhost:5173';
const app = spawn('node_modules/.bin/vite', ['dev', '--host', '0.0.0.0', '--port', '5173', '--strictPort'], { stdio: 'inherit' });
const contexts = [];
const context = async () => {
	const client = await request.newContext({ baseURL, maxRedirects: 0, extraHTTPHeaders: { origin: baseURL } });
	contexts.push(client);
	return client;
};
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
async function redirect(response, location, enhanced = false) {
	if (enhanced) {
		check(response.status() === 200, 'Enhanced redirect response');
		assert.deepEqual(await response.json(), { type: 'redirect', status: 303, location });
		return;
	}
	check(response.status() === 303, `Expected 303: ${response.url()} got ${response.status()}: ${await response.text()}`);
	assert.equal(response.headers().location, location);
}
async function snapshot() {
	return JSON.stringify(await Promise.all(['expenses', 'additional_incomes', 'students', 'payment_plans'].map((table) => sql`select * from ${sql(table)} order by id`)));
}

try {
	const anonymous = await context();
	let ready = false;
	for (let attempt = 0; attempt < 120; attempt++) {
		try { ready = (await anonymous.get('/login')).status() === 200; } catch {}
		if (ready) break;
		await setTimeout(1000);
	}
	assert.ok(ready, 'App did not start');
	const clients = { anonymous };
	for (const role of ['user', 'admin']) {
		const id = `http-auth-${role}`;
		const email = `${role}@auth-test.invalid`;
		const password = 'HttpTestPassword123!';
		await sql`delete from "user" where id = ${id}`;
		await sql`insert into "user" (id, name, email, role) values (${id}, ${role}, ${email}, ${role})`;
		await sql`insert into account (id, account_id, provider_id, user_id, password) values (${id}, ${id}, 'credential', ${id}, ${await hashPassword(password)})`;
		clients[role] = await context();
		const login = await clients[role].post('/api/auth/sign-in/email', { data: { email, password } });
		assert.equal(login.status(), 200, await login.text());
		check((await clients[role].get('/api/auth/get-session')).status() === 200, 'Session API available');
	}
	await sql`truncate expenses, additional_incomes, students, payment_plans restart identity cascade`;
	const [expense] = await sql`insert into expenses (amount, category, description, payment_method, paid_at) values (100, 'otro', 'PROTECTED-HTTP-FIXTURE', 'efectivo', now()) returning id`;
	const [income] = await sql`insert into additional_incomes (amount, description, payment_method, paid_at) values (100, 'PROTECTED-HTTP-INCOME', 'efectivo', now()) returning id`;
	const [plan] = await sql`insert into payment_plans (name, description, price, billing_period) values ('PROTECTED-HTTP-PLAN', 'fixture', 100, 'monthly') returning id`;
	for (const path of ['/dashboard', '/dashboard/alumnos', '/dashboard/clases', '/dashboard/pagos']) {
		await redirect(await anonymous.get(path), '/login');
		for (const role of ['user', 'admin']) check((await clients[role].get(path)).status() === 200, `${role} GET ${path}`);
	}
	for (const path of ['/dashboard/flujo-de-efectivo', '/%64ashboard/flujo-de-efectivo', '/dashboard/configuraciones/planes-de-pago']) {
		for (const role of ['anonymous', 'user']) {
			const target = role === 'anonymous' ? '/login' : '/dashboard?error=unauthorized';
			const response = await clients[role].get(path);
			await redirect(response, target);
			check(!(await response.text()).includes('PROTECTED-HTTP'), 'No protected HTML');
			const data = await clients[role].get(`${path}/__data.json?x-sveltekit-invalidated=11`);
			// SvelteKit serializes data-navigation redirects, unlike plain HTTP redirects.
			assert.deepEqual(await data.json(), { type: 'redirect', location: target });
			check(data.status() === 200, 'Data navigation redirect');
		}
		check((await clients.admin.get(path)).status() === 200, `admin GET ${path}`);
	}
	const cash = '/dashboard/flujo-de-efectivo';
	const plans = '/dashboard/configuraciones/planes-de-pago';
	const amount = { amount: '25', description: 'HTTP-created', paymentMethod: 'Efectivo', paidAt: '2026-10-21' };
	const planForm = { id: String(plan.id), name: 'HTTP-updated', description: 'fixture', planType: 'monthly', price: '50', billingPeriod: 'Mensual', classesIncluded: '', hoursIncluded: '' };
	const operations = [
		[`${cash}?/createExpense`, { ...amount, category: 'otro' }],
		[`${cash}?/createAdditionalIncome`, amount],
		[`${cash}?/deleteExpense`, { expenseId: String(expense.id) }],
		[`${cash}?/deleteAdditionalIncome`, { additionalIncomeId: String(income.id) }],
		[`${plans}?/update`, planForm],
		['/dashboard/alumnos?/create', { fullName: 'HTTP Student', phone: '5551234567', enrolledAt: '2026-10-21' }]
	];
	for (const [path, form] of operations) {
		for (const role of path.startsWith('/dashboard/alumnos') ? ['anonymous'] : ['anonymous', 'user']) {
			for (const enhanced of [false, true]) {
				const before = await snapshot();
				await redirect(await clients[role].post(path, { form, headers: enhanced ? { 'x-sveltekit-action': 'true', accept: 'application/json' } : { accept: 'text/html' } }), role === 'anonymous' ? '/login' : '/dashboard?error=unauthorized', enhanced);
				assert.equal(await snapshot(), before, `${role} mutation blocked ${path}`);
			}
		}
		const before = await snapshot();
		const response = await clients.admin.post(path, { form, headers: { 'x-sveltekit-action': 'true', accept: 'application/json' } });
		check(response.status() === 200, `Admin action ${path}: ${await response.text()}`);
		const body = await response.json();
		check(['success', 'redirect'].includes(body.type), `Admin action success ${path}`);
		check(await snapshot() !== before, `Admin action persisted ${path}`);
	}
	check((await anonymous.get('/login')).status() === 200, 'Public login');
	const userStudent = await clients.user.post('/dashboard/alumnos?/create', { form: { fullName: 'User permitted student', phone: '5551234567', enrolledAt: '2026-10-21' }, headers: { 'x-sveltekit-action': 'true', accept: 'application/json' } });
	assert.equal((await userStudent.json()).type, 'success');
	check((await sql`select id from students where full_name = 'User permitted student'`).length === 1, 'User permitted mutation persisted');
	await sql`update session set expires_at = now() - interval '1 day' where user_id = 'http-auth-user'`;
	await redirect(await clients.user.get('/dashboard/alumnos'), '/login');
	check((await anonymous.get('/dashboard-ajeno')).status() === 404, 'Dashboard boundary');
	console.log(`HTTP dashboard authorization: ${checks} checks passed (real login and PostgreSQL persistence).`);
} finally {
	app.kill('SIGTERM');
	await Promise.all(contexts.map((client) => client.dispose()));
	await sql.end();
}
