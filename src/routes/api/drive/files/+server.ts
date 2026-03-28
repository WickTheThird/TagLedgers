import { json } from '@sveltejs/kit';
import { getSession } from '$lib/server/session';
import { listDriveFiles } from '$lib/server/google';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const session = getSession(cookies);
	if (!session) return json({ error: 'Not authenticated' }, { status: 401 });

	try {
		const files = await listDriveFiles();
		return json({ files });
	} catch (e) {
		console.error('Drive list error:', e);
		return json({ error: 'Failed to list files' }, { status: 500 });
	}
};
