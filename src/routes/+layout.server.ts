import { getSession } from '$lib/server/session';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const session = getSession(cookies);
	return {
		user: session ? { email: session.email, name: session.name, picture: session.picture } : null
	};
};
