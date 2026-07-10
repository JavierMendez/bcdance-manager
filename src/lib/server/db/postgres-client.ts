import postgres from 'postgres';

function needsSsl(url: string): boolean {
	return (
		url.includes('supabase.co') || url.includes('sslmode=require') || url.includes('ssl=true')
	);
}

export function createPostgresClient(
	url: string,
	options: postgres.Options<Record<string, never>> = {}
) {
	return postgres(url, {
		...options,
		...(needsSsl(url) && options.ssl === undefined ? { ssl: 'require' } : {})
	});
}
