import { json } from '@sveltejs/kit';
import { getSession } from '$lib/server/session';
import { getLedgerEntries, addLedgerEntry } from '$lib/server/google';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const session = getSession(cookies);
	if (!session) return json({ error: 'Not authenticated' }, { status: 401 });

	try {
		const entries = await getLedgerEntries();
		return json({ entries });
	} catch (e) {
		console.error('Ledger read error:', e);
		return json({ error: 'Failed to read ledger' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	const session = getSession(cookies);
	if (!session) return json({ error: 'Not authenticated' }, { status: 401 });

	try {
		const entry = await request.json();
		await addLedgerEntry(entry, session.email);
		return json({ success: true });
	} catch (e) {
		console.error('Ledger write error:', e);
		return json({ error: 'Failed to update ledger' }, { status: 500 });
	}
};
