import { getValidAccessToken } from '$lib/server/session';
import { downloadDriveFile } from '$lib/server/google';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, params }) => {
	try {
		const { token } = await getValidAccessToken(cookies);
		const buffer = await downloadDriveFile(params.fileId, token);
		return new Response(buffer, {
			headers: { 'Content-Type': 'application/octet-stream' }
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Unknown error';
		if (msg.includes('Not authenticated') || msg.includes('No refresh token')) {
			return new Response('Not authenticated', { status: 401 });
		}
		console.error('Drive download error:', e);
		return new Response('Failed to download file', { status: 500 });
	}
};
