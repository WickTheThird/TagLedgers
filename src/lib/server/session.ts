import type { Cookies } from '@sveltejs/kit';
import { refreshAccessToken } from '$lib/server/google';

const SESSION_COOKIE = 'tagledger_session';

export interface SessionData {
	accessToken: string;
	refreshToken: string;
	email: string;
	name: string;
	picture: string;
	expiresAt: number;
}

export function setSession(cookies: Cookies, data: SessionData) {
	cookies.set(SESSION_COOKIE, JSON.stringify(data), {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30
	});
}

export function getSession(cookies: Cookies): SessionData | null {
	const raw = cookies.get(SESSION_COOKIE);
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function clearSession(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

/**
 * Returns a valid access token, auto-refreshing if expired.
 * Updates the session cookie with the new token.
 */
export async function getValidAccessToken(cookies: Cookies): Promise<{ token: string; session: SessionData }> {
	const session = getSession(cookies);
	if (!session) throw new Error('Not authenticated');

	// If token is still valid (with 5 min buffer), return it
	if (session.expiresAt > Date.now() + 5 * 60 * 1000) {
		return { token: session.accessToken, session };
	}

	// Token expired or about to expire — refresh it
	if (!session.refreshToken) {
		throw new Error('No refresh token available, please log in again');
	}

	const newTokens = await refreshAccessToken(session.refreshToken);
	const updatedSession: SessionData = {
		...session,
		accessToken: newTokens.access_token,
		expiresAt: Date.now() + newTokens.expires_in * 1000
	};

	setSession(cookies, updatedSession);
	return { token: updatedSession.accessToken, session: updatedSession };
}
