import { json } from '@sveltejs/kit';
import { getSession } from '$lib/server/session';
import { uploadToDrive } from '$lib/server/google';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, request }) => {
	const session = getSession(cookies);
	if (!session) return json({ error: 'Not authenticated' }, { status: 401 });

	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const folderId = formData.get('folderId') as string;

		if (!file || !folderId) {
			return json({ error: 'Missing file or folderId' }, { status: 400 });
		}

		const buffer = await file.arrayBuffer();
		const mimeType = file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
		const result = await uploadToDrive(folderId, file.name, buffer, mimeType, session.accessToken);
		return json(result);
	} catch (e) {
		console.error('Drive upload error:', e);
		return json({ error: 'Failed to upload file' }, { status: 500 });
	}
};
