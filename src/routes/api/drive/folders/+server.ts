import { json } from '@sveltejs/kit';
import { getSession } from '$lib/server/session';
import { getBankXlsxFolderId, getWebsiteDbFolderId } from '$lib/server/google';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const session = getSession(cookies);
	if (!session) return json({ error: 'Not authenticated' }, { status: 401 });

	return json({
		bankFolder: getBankXlsxFolderId(),
		dbFolder: getWebsiteDbFolderId()
	});
};
