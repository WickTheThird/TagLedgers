// TagLedger Cloudflare Worker - API Backend
const CORS_HEADERS = {
	'Access-Control-Allow-Credentials': 'true',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsHeaders(env) {
	return { ...CORS_HEADERS, 'Access-Control-Allow-Origin': env.FRONTEND_URL || 'https://tagledgers.com' };
}

function jsonResponse(data, status = 200, env) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json', ...corsHeaders(env) }
	});
}

// --- Session (encrypted cookie) ---
async function encryptSession(data, secret) {
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32)), 'AES-GCM', false, ['encrypt']);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));
	const combined = new Uint8Array(iv.length + encrypted.byteLength);
	combined.set(iv, 0);
	combined.set(new Uint8Array(encrypted), iv.length);
	return btoa(String.fromCharCode(...combined));
}

async function decryptSession(cookie, secret) {
	try {
		const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32)), 'AES-GCM', false, ['decrypt']);
		const data = Uint8Array.from(atob(cookie), c => c.charCodeAt(0));
		const iv = data.slice(0, 12);
		const encrypted = data.slice(12);
		const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
		return JSON.parse(new TextDecoder().decode(decrypted));
	} catch { return null; }
}

function getSessionToken(request) {
	// Check Authorization header first, then cookie fallback
	const authHeader = request.headers.get('Authorization') || '';
	if (authHeader.startsWith('Bearer ')) {
		return authHeader.slice(7);
	}
	const cookies = request.headers.get('Cookie') || '';
	const match = cookies.match(/tagledger_session=([^;]+)/);
	return match ? match[1] : null;
}

// --- Google Service Account JWT ---
function base64url(data) {
	return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createServiceJWT(key) {
	const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const now = Math.floor(Date.now() / 1000);
	const payload = base64url(JSON.stringify({
		iss: key.client_email, scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
		aud: key.token_uri, iat: now, exp: now + 3600
	}));
	const signInput = `${header}.${payload}`;
	const pem = key.private_key.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\n/g, '');
	const binaryKey = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
	const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
	const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signInput));
	return `${signInput}.${base64url(String.fromCharCode(...new Uint8Array(signature)))}`;
}

let cachedToken = null;
async function getServiceToken(env) {
	if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
	const key = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
	const jwt = await createServiceJWT(key);
	const res = await fetch(key.token_uri, {
		method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
	});
	const data = await res.json();
	cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
	return cachedToken.token;
}

// --- Route Handlers ---
async function handleAuthGoogle(env) {
	console.log('AUTH GOOGLE: redirect_uri =', env.GOOGLE_REDIRECT_URI);
	const params = new URLSearchParams({
		client_id: env.GOOGLE_CLIENT_ID, redirect_uri: env.GOOGLE_REDIRECT_URI,
		response_type: 'code', scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
		access_type: 'offline', prompt: 'consent'
	});
	return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}

async function handleAuthCallback(request, env) {
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');
	console.log('AUTH CALLBACK: code =', code ? 'yes' : 'no', 'error =', error || 'none');

	if (error) {
		console.error('Google returned error:', error);
		return Response.redirect(`${env.FRONTEND_URL}/login?error=auth_failed&detail=${error}`, 302);
	}
	if (!code) return Response.redirect(`${env.FRONTEND_URL}/login?error=no_code`, 302);

	try {
		console.log('Exchanging code for tokens...');
		console.log('redirect_uri =', env.GOOGLE_REDIRECT_URI);
		const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
				redirect_uri: env.GOOGLE_REDIRECT_URI, grant_type: 'authorization_code'
			})
		});
		const tokens = await tokenRes.json();
		console.log('Token response status:', tokenRes.status);
		if (!tokens.access_token) {
			console.error('Token exchange failed:', JSON.stringify(tokens));
			return Response.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`, 302);
		}
		console.log('Got access token, fetching user info...');

		const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
			headers: { Authorization: `Bearer ${tokens.access_token}` }
		});
		const user = await userRes.json();
		console.log('User:', user.email);

		const allowed = (env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
		if (allowed.length && !allowed.includes(user.email.toLowerCase())) {
			console.log('User not in allowlist:', user.email);
			return Response.redirect(`${env.FRONTEND_URL}/login?error=not_allowed`, 302);
		}

		const session = await encryptSession({
			accessToken: tokens.access_token, refreshToken: tokens.refresh_token || '',
			email: user.email, name: user.name, picture: user.picture,
			expiresAt: Date.now() + tokens.expires_in * 1000
		}, env.SESSION_SECRET);

		console.log('Auth success, redirecting to', env.FRONTEND_URL);
		// Redirect with token in hash fragment - never sent to server, no Chrome warning
		const frontendUrl = env.FRONTEND_URL || 'https://tagledgers.com';
		return Response.redirect(`${frontendUrl}/#token=${encodeURIComponent(session)}`, 302);
	} catch (e) {
		console.error('Auth callback exception:', e.message || e);
		return Response.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`, 302);
	}
}

async function handleAuthMe(request, env) {
	const cookie = getSessionToken(request);
	if (!cookie) return jsonResponse({ user: null }, 200, env);
	const session = await decryptSession(cookie, env.SESSION_SECRET);
	if (!session) return jsonResponse({ user: null }, 200, env);
	return jsonResponse({ user: { email: session.email, name: session.name, picture: session.picture } }, 200, env);
}

async function handleAuthLogout(env) {
	return new Response(null, {
		status: 302, headers: {
			Location: `${env.FRONTEND_URL}/login`,
			...corsHeaders(env)
		}
	});
}

async function handleDriveFiles(request, env) {
	const cookie = getSessionToken(request);
	if (!cookie) return jsonResponse({ error: 'Not authenticated' }, 401, env);
	const session = await decryptSession(cookie, env.SESSION_SECRET);
	if (!session) return jsonResponse({ error: 'Not authenticated' }, 401, env);

	const token = await getServiceToken(env);
	const folderIds = (env.DRIVE_FOLDER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
	const folderQuery = folderIds.map(id => `'${id}' in parents`).join(' or ');
	const query = `(${folderQuery}) and (mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel') and trashed=false`;

	const params = new URLSearchParams({
		q: query, fields: 'files(id,name,mimeType,modifiedTime,size,parents)',
		orderBy: 'modifiedTime desc', pageSize: '100', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true'
	});

	const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	const data = await res.json();
	return jsonResponse({ files: data.files || [] }, 200, env);
}

async function handleDriveDownload(fileId, request, env) {
	const cookie = getSessionToken(request);
	if (!cookie) return new Response('Not authenticated', { status: 401, headers: corsHeaders(env) });
	const session = await decryptSession(cookie, env.SESSION_SECRET);
	if (!session) return new Response('Not authenticated', { status: 401, headers: corsHeaders(env) });

	const token = await getServiceToken(env);
	const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	const buffer = await res.arrayBuffer();
	return new Response(buffer, { headers: { 'Content-Type': 'application/octet-stream', ...corsHeaders(env) } });
}

async function handleDriveFolders(request, env) {
	const cookie = getSessionToken(request);
	if (!cookie) return jsonResponse({ error: 'Not authenticated' }, 401, env);
	const folderIds = (env.DRIVE_FOLDER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
	return jsonResponse({ bankFolder: folderIds[0] || '', dbFolder: folderIds[1] || '' }, 200, env);
}

async function handleDriveUpload(request, env) {
	const cookie = getSessionToken(request);
	if (!cookie) return jsonResponse({ error: 'Not authenticated' }, 401, env);
	const session = await decryptSession(cookie, env.SESSION_SECRET);
	if (!session) return jsonResponse({ error: 'Not authenticated' }, 401, env);

	const formData = await request.formData();
	const file = formData.get('file');
	const folderId = formData.get('folderId');
	if (!file || !folderId) return jsonResponse({ error: 'Missing file or folderId' }, 400, env);

	const buffer = await file.arrayBuffer();
	const mimeType = file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

	const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
		method: 'POST', headers: {
			Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json',
			'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(buffer.byteLength)
		},
		body: JSON.stringify({ name: file.name, parents: [folderId] })
	});
	if (!initRes.ok) return jsonResponse({ error: 'Upload init failed' }, 500, env);
	const uploadUrl = initRes.headers.get('Location');

	const uploadRes = await fetch(uploadUrl, {
		method: 'PUT', headers: { 'Content-Type': mimeType, 'Content-Length': String(buffer.byteLength) },
		body: buffer
	});
	if (!uploadRes.ok) return jsonResponse({ error: 'Upload failed' }, 500, env);
	const result = await uploadRes.json();
	return jsonResponse({ id: result.id, name: result.name, webViewLink: `https://drive.google.com/file/d/${result.id}/view` }, 200, env);
}

async function handleLedgerGet(request, env) {
	const cookie = getSessionToken(request);
	if (!cookie) return jsonResponse({ error: 'Not authenticated' }, 401, env);

	const sheetId = env.DB_LEDGER_SHEET_ID;
	if (!sheetId) return jsonResponse({ entries: [] }, 200, env);

	const token = await getServiceToken(env);
	const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:H`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) return jsonResponse({ entries: [] }, 200, env);
	const data = await res.json();
	const rows = data.values || [];
	if (rows.length < 2) return jsonResponse({ entries: [] }, 200, env);

	const entries = rows.slice(1).map(row => ({
		fileName: row[0] || '', driveFileId: row[1] || '', driveLink: row[2] || '',
		folder: row[3] || '', uploadedBy: row[4] || '', uploadedAt: row[5] || '',
		sheetCount: parseInt(row[6] || '0'), transactionCount: parseInt(row[7] || '0')
	}));
	return jsonResponse({ entries }, 200, env);
}

async function handleLedgerPost(request, env) {
	const cookie = getSessionToken(request);
	if (!cookie) return jsonResponse({ error: 'Not authenticated' }, 401, env);
	const session = await decryptSession(cookie, env.SESSION_SECRET);
	if (!session) return jsonResponse({ error: 'Not authenticated' }, 401, env);

	const sheetId = env.DB_LEDGER_SHEET_ID;
	if (!sheetId) return jsonResponse({ success: true }, 200, env);

	const entry = await request.json();
	const token = await getServiceToken(env);

	const checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:D`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (checkRes.ok) {
		const checkData = await checkRes.json();
		const rows = checkData.values || [];
		if (rows.some(r => r[0] === entry.fileName && r[3] === entry.folder)) {
			return jsonResponse({ success: true, duplicate: true }, 200, env);
		}
		if (rows.length === 0) {
			await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:H1?valueInputOption=RAW`, {
				method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ values: [['File Name', 'Drive File ID', 'Drive Link', 'Folder', 'Uploaded By', 'Uploaded At', 'Sheet Count', 'Transaction Count']] })
			});
		}
	}

	const row = [entry.fileName, entry.driveFileId, entry.driveLink, entry.folder, session.email,
		new Date().toISOString(), String(entry.sheetCount), String(entry.transactionCount)];

	await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:H:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
		method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ values: [row] })
	});
	return jsonResponse({ success: true }, 200, env);
}

// --- Update existing Drive file (replace content) ---
async function handleDriveUpdate(fileId, request, env) {
	const tokenStr = getSessionToken(request);
	if (!tokenStr) return jsonResponse({ error: 'Not authenticated' }, 401, env);
	const session = await decryptSession(tokenStr, env.SESSION_SECRET);
	if (!session) return jsonResponse({ error: 'Not authenticated' }, 401, env);

	const formData = await request.formData();
	const file = formData.get('file');
	if (!file) return jsonResponse({ error: 'Missing file' }, 400, env);

	const buffer = await file.arrayBuffer();
	const mimeType = file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
	const token = await getServiceToken(env);

	// Use Drive API PATCH to replace file content (keeps same file ID)
	const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': mimeType,
			'Content-Length': String(buffer.byteLength)
		},
		body: buffer
	});

	if (!res.ok) {
		const errText = await res.text();
		console.error('Drive update failed:', res.status, errText);
		return jsonResponse({ error: 'Failed to update file' }, 500, env);
	}

	const result = await res.json();
	return jsonResponse({ id: result.id, name: result.name }, 200, env);
}

// --- Main Router ---
export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname;

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders(env) });
		}

		try {
			if (path === '/api/auth/google') return await handleAuthGoogle(env);
			if (path === '/api/auth/callback') return await handleAuthCallback(request, env);
			if (path === '/api/auth/me') return await handleAuthMe(request, env);
			if (path === '/api/auth/logout') return await handleAuthLogout(env);
			if (path === '/api/drive/files') return await handleDriveFiles(request, env);
			if (path === '/api/drive/folders') return await handleDriveFolders(request, env);
			if (path === '/api/drive/upload' && request.method === 'POST') return await handleDriveUpload(request, env);
			if (path === '/api/ledger' && request.method === 'GET') return await handleLedgerGet(request, env);
			if (path === '/api/ledger' && request.method === 'POST') return await handleLedgerPost(request, env);

			const downloadMatch = path.match(/^\/api\/drive\/download\/(.+)$/);
			if (downloadMatch) return await handleDriveDownload(downloadMatch[1], request, env);

			const updateMatch = path.match(/^\/api\/drive\/update\/(.+)$/);
			if (updateMatch && request.method === 'PUT') return await handleDriveUpdate(updateMatch[1], request, env);

			return new Response('Not found', { status: 404, headers: corsHeaders(env) });
		} catch (e) {
			console.error('Worker error:', e.message || e);
			return jsonResponse({ error: 'Internal error' }, 500, env);
		}
	}
};
