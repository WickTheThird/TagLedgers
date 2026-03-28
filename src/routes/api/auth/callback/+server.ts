import { redirect } from '@sveltejs/kit';
import { exchangeCodeForTokens, getUserInfo, isEmailAllowed } from '$lib/server/google';
import { setSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	if (!code) throw redirect(302, '/login?error=no_code');

	try {
		const tokens = await exchangeCodeForTokens(code);
		const user = await getUserInfo(tokens.access_token);

		if (!isEmailAllowed(user.email)) {
			throw redirect(302, '/login?error=not_allowed');
		}

		setSession(cookies, {
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token ?? '',
			email: user.email,
			name: user.name,
			picture: user.picture,
			expiresAt: Date.now() + tokens.expires_in * 1000
		});

		throw redirect(302, '/');
	} catch (e: unknown) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		console.error('Auth callback error:', e);
		throw redirect(302, '/login?error=auth_failed');
	}
};
