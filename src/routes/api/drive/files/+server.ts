import { json } from '@sveltejs/kit';
import { getValidAccessToken } from '$lib/server/session';
import { listDriveFiles, getLedgerEntries } from '$lib/server/google';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const { token, session } = await getValidAccessToken(cookies);
		const [allFiles, ledgerEntries] = await Promise.all([
			listDriveFiles(token),
			getLedgerEntries()
		]);

		// Filter: only show files uploaded by the current user (based on ledger)
		const userFileIds = new Set(
			ledgerEntries
				.filter(e => e.uploadedBy.toLowerCase() === session.email.toLowerCase())
				.map(e => e.driveFileId)
		);

		const files = allFiles.filter((f: { id: string }) => userFileIds.has(f.id));

		return json({ files });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Unknown error';
		if (msg.includes('Not authenticated') || msg.includes('No refresh token') || msg.includes('insufficient authentication scopes')) {
			return json({ error: 'Please log out and log back in' }, { status: 401 });
		}
		console.error('Drive list error:', e);
		return json({ error: 'Failed to list files' }, { status: 500 });
	}
};
