export interface Transaction {
	id: string;
	date: Date;
	description: string;
	description2: string;
	debit: number | null;
	credit: number | null;
	balance: number | null;
	currency: string;
	type: 'Credit' | 'Debit';
	tag: string;
	notes: string;
	sourceSheet: string;
	account: string;
	year: number;
	fileName: string;
}

export interface FilterState {
	dateFrom: string;
	dateTo: string;
	accounts: string[];
	tags: string[];
	types: ('Credit' | 'Debit')[];
	sheets: string[];
	search: string;
	hideTransfers: boolean;
}

export interface TransferMatch {
	id: string;
	debitTxId: string;
	creditTxId: string;
	amount: number;
	currency: string;
	score: number;
	confidence: 'high' | 'medium';
	status: 'auto' | 'confirmed' | 'rejected';
}

export interface TagSummary {
	tag: string;
	totalDebit: number;
	totalCredit: number;
	net: number;
	count: number;
}

export interface PnLCategory {
	tag: string;
	amount: number;
	count: number;
	children?: PnLCategory[];
}

export interface PnLGroup {
	name: string;
	revenue: PnLCategory[];
	expenses: PnLCategory[];
	totalRevenue: number;
	totalExpenses: number;
	netIncome: number;
}

export interface AutoTagRule {
	id: string;
	pattern: string;
	tag: string;
	field: 'description' | 'description2' | 'notes';
	caseSensitive: boolean;
}

export interface UserSession {
	accessToken: string;
	refreshToken: string;
	email: string;
	name: string;
	picture: string;
	expiresAt: number;
}

export interface DriveFile {
	id: string;
	name: string;
	mimeType: string;
	modifiedTime: string;
	size: string;
}
