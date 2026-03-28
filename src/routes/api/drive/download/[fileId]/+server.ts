import { getSession } from '$lib/server/session';
import { downloadDriveFile } from '$lib/server/google';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, params }) => {
	const session = getSession(cookies);
	if (!session) return new Response('Not authenticated', { status: 401 });

	try {
		const buffer = await downloadDriveFile(params.fileId);
		return new Response(buffer, {
			headers: { 'Content-Type': 'application/octet-stream' }
		});
	} catch (e) {
		console.error('Drive download error:', e);
		return new Response('Failed to download file', { status: 500 });
	}
};
