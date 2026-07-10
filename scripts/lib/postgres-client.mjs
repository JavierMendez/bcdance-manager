import postgres from 'postgres';

function needsSsl(url) {
	return (
		url.includes('supabase.co') || url.includes('sslmode=require') || url.includes('ssl=true')
	);
}

export function createPostgresClient(url, options = {}) {
	return postgres(url, {
		...options,
		...(needsSsl(url) && options.ssl === undefined ? { ssl: 'require' } : {})
	});
}
