import { redirect } from '@sveltejs/kit';
import { getAuthUrl } from '$lib/server/google';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	throw redirect(302, getAuthUrl());
};
