import { env } from '$env/dynamic/private';

// --- OAuth (for user login identity) ---

function getConfig() {
	return {
		clientId: env.GOOGLE_CLIENT_ID ?? '',
		clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
		redirectUri: env.GOOGLE_REDIRECT_URI ?? ''
	};
}

export function getAuthUrl() {
	const { clientId, redirectUri } = getConfig();
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
		access_type: 'offline',
		prompt: 'consent'
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(code: string) {
	const { clientId, clientSecret, redirectUri } = getConfig();
	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code, client_id: clientId, client_secret: clientSecret,
			redirect_uri: redirectUri, grant_type: 'authorization_code'
		})
	});
	if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
	return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
}

export async function getUserInfo(accessToken: string) {
	const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (!res.ok) throw new Error('Failed to get user info');
	return res.json() as Promise<{ email: string; name: string; picture: string }>;
}

export function isEmailAllowed(email: string): boolean {
	const allowed = env.ALLOWED_EMAILS ?? '';
	if (!allowed) return true; // no allowlist = allow all
	return allowed.split(',').map(e => e.trim().toLowerCase()).includes(email.toLowerCase());
}

// --- Service Account (for accessing owner's Drive) ---

interface ServiceAccountKey {
	client_email: string;
	private_key: string;
	token_uri: string;
}

let cachedServiceToken: { token: string; expiresAt: number } | null = null;

function base64url(data: string): string {
	return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createJWT(key: ServiceAccountKey): Promise<string> {
	const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const now = Math.floor(Date.now() / 1000);
	const payload = base64url(JSON.stringify({
		iss: key.client_email,
		scope: 'https://www.googleapis.com/auth/drive',
		aud: key.token_uri,
		iat: now,
		exp: now + 3600
	}));

	const signInput = `${header}.${payload}`;

	// Import the private key for signing
	const pemContents = key.private_key
		.replace(/-----BEGIN PRIVATE KEY-----/, '')
		.replace(/-----END PRIVATE KEY-----/, '')
		.replace(/\n/g, '');
	const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

	const cryptoKey = await crypto.subtle.importKey(
		'pkcs8', binaryKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false, ['sign']
	);

	const signature = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5', cryptoKey,
		new TextEncoder().encode(signInput)
	);

	const sig = base64url(String.fromCharCode(...new Uint8Array(signature)));
	return `${signInput}.${sig}`;
}

async function getServiceAccountToken(): Promise<string> {
	if (cachedServiceToken && cachedServiceToken.expiresAt > Date.now()) {
		return cachedServiceToken.token;
	}

	const keyJson = env.GOOGLE_SERVICE_ACCOUNT_KEY;
	if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');

	const key: ServiceAccountKey = JSON.parse(keyJson);
	const jwt = await createJWT(key);

	const res = await fetch(key.token_uri, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt
		})
	});

	if (!res.ok) throw new Error(`Service account auth failed: ${await res.text()}`);
	const data = await res.json();

	cachedServiceToken = {
		token: data.access_token,
		expiresAt: Date.now() + (data.expires_in - 60) * 1000
	};

	return cachedServiceToken.token;
}

// --- Drive API (using service account) ---

export function getDriveFolderIds(): string[] {
	const ids = env.DRIVE_FOLDER_IDS ?? '';
	return ids.split(',').map(id => id.trim()).filter(Boolean);
}

export async function listDriveFiles() {
	const token = await getServiceAccountToken();
	const folderIds = getDriveFolderIds();

	if (folderIds.length === 0) {
		throw new Error('DRIVE_FOLDER_IDS not configured');
	}

	// Query files in the specified folders
	const folderQuery = folderIds.map(id => `'${id}' in parents`).join(' or ');
	const query = `(${folderQuery}) and (mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel') and trashed=false`;

	const params = new URLSearchParams({
		q: query,
		fields: 'files(id,name,mimeType,modifiedTime,size,parents)',
		orderBy: 'modifiedTime desc',
		pageSize: '100',
		supportsAllDrives: 'true',
		includeItemsFromAllDrives: 'true'
	});

	const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Drive list failed: ${err}`);
	}

	const data = await res.json();
	return data.files ?? [];
}

export async function downloadDriveFile(fileId: string): Promise<ArrayBuffer> {
	const token = await getServiceAccountToken();
	const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) throw new Error('Failed to download file');
	return res.arrayBuffer();
}

export async function uploadToDrive(folderId: string, fileName: string, buffer: ArrayBuffer, mimeType: string, userAccessToken?: string) {
	// Use user token if provided (service accounts can't own files)
	const token = userAccessToken ?? await getServiceAccountToken();

	// Step 1: Start resumable upload with metadata
	const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			'X-Upload-Content-Type': mimeType,
			'X-Upload-Content-Length': String(buffer.byteLength)
		},
		body: JSON.stringify({
			name: fileName,
			parents: [folderId]
		})
	});

	if (!initRes.ok) {
		const err = await initRes.text();
		throw new Error(`Upload init failed: ${err}`);
	}

	const uploadUrl = initRes.headers.get('Location');
	if (!uploadUrl) throw new Error('No upload URL returned');

	// Step 2: Upload the file content
	const uploadRes = await fetch(uploadUrl, {
		method: 'PUT',
		headers: {
			'Content-Type': mimeType,
			'Content-Length': String(buffer.byteLength)
		},
		body: buffer
	});

	if (!uploadRes.ok) {
		const err = await uploadRes.text();
		throw new Error(`Upload failed: ${err}`);
	}

	const file = await uploadRes.json();
	return { id: file.id, name: file.name, webViewLink: `https://drive.google.com/file/d/${file.id}/view` };
}

// --- Google Sheets API (DB Ledger) ---

export interface LedgerEntry {
	fileName: string;
	driveFileId: string;
	driveLink: string;
	folder: string;
	uploadedBy: string;
	uploadedAt: string;
	sheetCount: number;
	transactionCount: number;
}

export async function getLedgerEntries(): Promise<LedgerEntry[]> {
	const sheetId = env.DB_LEDGER_SHEET_ID;
	if (!sheetId) return [];

	const token = await getServiceAccountToken();
	const res = await fetch(
		`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:H`,
		{ headers: { Authorization: `Bearer ${token}` } }
	);

	if (!res.ok) {
		const err = await res.text();
		// If sheet is empty or doesn't have headers yet, return empty
		if (res.status === 400) return [];
		throw new Error(`Sheets read failed: ${err}`);
	}

	const data = await res.json();
	const rows: string[][] = data.values ?? [];
	if (rows.length < 2) return [];

	return rows.slice(1).map(row => ({
		fileName: row[0] ?? '',
		driveFileId: row[1] ?? '',
		driveLink: row[2] ?? '',
		folder: row[3] ?? '',
		uploadedBy: row[4] ?? '',
		uploadedAt: row[5] ?? '',
		sheetCount: parseInt(row[6] ?? '0'),
		transactionCount: parseInt(row[7] ?? '0')
	}));
}

export async function addLedgerEntry(entry: Omit<LedgerEntry, 'uploadedAt' | 'uploadedBy'> & { uploadedBy?: string }, userEmail: string) {
	const sheetId = env.DB_LEDGER_SHEET_ID;
	if (!sheetId) return;

	const token = await getServiceAccountToken();

	// Check if headers exist, if not create them
	const checkRes = await fetch(
		`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:H1`,
		{ headers: { Authorization: `Bearer ${token}` } }
	);

	if (checkRes.ok) {
		const checkData = await checkRes.json();
		if (!checkData.values || checkData.values.length === 0) {
			// Add headers
			await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:H1?valueInputOption=RAW`,
				{
					method: 'PUT',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({
						values: [['File Name', 'Drive File ID', 'Drive Link', 'Folder', 'Uploaded By', 'Uploaded At', 'Sheet Count', 'Transaction Count']]
					})
				}
			);
		}
	}

	// Check for duplicate: same fileName + folder = skip
	const existingEntries = await getLedgerEntries();
	if (existingEntries.some(e => e.fileName === entry.fileName && e.folder === entry.folder)) {
		return; // Already tracked
	}

	// Append the new entry
	const now = new Date().toISOString();
	const row = [
		entry.fileName,
		entry.driveFileId,
		entry.driveLink,
		entry.folder,
		userEmail,
		now,
		String(entry.sheetCount),
		String(entry.transactionCount)
	];

	const appendRes = await fetch(
		`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:H:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
		{
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ values: [row] })
		}
	);

	if (!appendRes.ok) {
		const err = await appendRes.text();
		throw new Error(`Sheets append failed: ${err}`);
	}
}

// Get specific folder ID by purpose
export function getBankXlsxFolderId(): string {
	return getDriveFolderIds()[0] ?? '';
}

export function getWebsiteDbFolderId(): string {
	return getDriveFolderIds()[1] ?? '';
}
