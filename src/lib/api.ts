// API base URL - points to the Cloudflare Worker
// In dev: the Worker runs locally or we proxy to the SvelteKit dev server
// In prod: the Worker runs at the same domain via Cloudflare routing
const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiUrl(path: string): string {
	return `${API_BASE}${path}`;
}

// Helper for authenticated API calls
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
	return fetch(apiUrl(path), {
		...init,
		credentials: 'include' // send cookies for auth
	});
}
