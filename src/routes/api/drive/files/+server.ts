import { json } from '@sveltejs/kit';
import { getValidAccessToken } from '$lib/server/session';
import { listDriveFiles } from '$lib/server/google';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const { token } = await getValidAccessToken(cookies);
		const files = await listDriveFiles(token);
		return json({ files });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Unknown error';
		if (msg.includes('Not authenticated') || msg.includes('No refresh token')) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}
		console.error('Drive list error:', e);
		return json({ error: 'Failed to list files' }, { status: 500 });
	}
};
