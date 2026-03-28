import type { Cookies } from '@sveltejs/kit';

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
