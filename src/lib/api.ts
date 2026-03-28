const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiUrl(path: string): string {
	return `${API_BASE}${path}`;
}

// Store/retrieve session token in localStorage
export function getSessionToken(): string | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem('tagledger_token');
}

export function setSessionToken(token: string) {
	localStorage.setItem('tagledger_token', token);
}

export function clearSessionToken() {
	localStorage.removeItem('tagledger_token');
}

// Authenticated API calls using Authorization header
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
	const token = getSessionToken();
	const headers: Record<string, string> = {
		...(init?.headers as Record<string, string> || {})
	};
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}
	return fetch(apiUrl(path), { ...init, headers });
}
