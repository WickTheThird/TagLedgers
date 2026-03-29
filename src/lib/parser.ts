import * as XLSX from 'xlsx';
import type { Transaction } from './types';

const HEADER_PATTERNS: [RegExp, string][] = [
	[/posted.*date/i, 'date'],
	[/^date$/i, 'date'],
	[/started\s*date/i, 'date'],
	[/completed\s*date/i, 'date'],
	[/description\s*1/i, 'description'],
	[/^description$/i, 'description'],
	[/description\s*2/i, 'description2'],
	[/debit/i, 'debit'],
	[/money\s*out/i, 'debit'],
	[/credit/i, 'credit'],
	[/money\s*in/i, 'credit'],
	[/balance/i, 'balance'],
	[/currency/i, 'currency'],
	[/transaction\s*type/i, 'type'],
	[/^type$/i, 'type'],
	[/column\s*1/i, 'tag'],
	[/^tag$/i, 'tag'],
	[/^category$/i, 'tag'],
	[/^classification$/i, 'tag'],
	[/column\s*2/i, 'notes'],
	[/^notes$/i, 'notes'],
];

function parseSheetName(name: string): { year: number; account: string } {
	const match = name.match(/^(\d{4})\s+(.+)$/);
	if (match) return { year: parseInt(match[1]), account: match[2].trim() };
	const yearOnly = name.match(/^(\d{4})$/);
	if (yearOnly) return { year: parseInt(yearOnly[1]), account: 'DEFAULT' };
	return { year: 0, account: name };
}

function detectHeaders(row: unknown[]): Record<number, string> | null {
	const mapping: Record<number, string> = {};
	const usedFields = new Set<string>();
	let found = 0;

	for (let i = 0; i < row.length; i++) {
		const cell = String(row[i] ?? '').trim();
		if (!cell) continue;

		for (const [pattern, field] of HEADER_PATTERNS) {
			if (!usedFields.has(field) && pattern.test(cell)) {
				mapping[i] = field;
				usedFields.add(field);
				found++;
				break;
			}
		}
	}
	return found >= 3 ? mapping : null;
}

function parseNumber(val: unknown): number | null {
	if (val == null || val === '') return null;
	if (typeof val === 'number') return isNaN(val) ? null : val;
	const s = String(val).replace(/[,\s]/g, '').trim();
	if (!s) return null;
	const n = parseFloat(s);
	return isNaN(n) ? null : n;
}

function parseDate(val: unknown): Date | null {
	if (val instanceof Date) return val;
	if (typeof val === 'number') {
		// Excel serial date
		const d = new Date((val - 25569) * 86400 * 1000);
		return isNaN(d.getTime()) ? null : d;
	}
	if (typeof val === 'string') {
		const d = new Date(val);
		return isNaN(d.getTime()) ? null : d;
	}
	return null;
}

export function parseExcelBuffer(buffer: ArrayBuffer, fileName: string): Transaction[] {
	const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
	const transactions: Transaction[] = [];
	let globalId = 0;
	const batch = Math.random().toString(36).slice(2, 8);

	for (const sheetName of workbook.SheetNames) {
		const sheet = workbook.Sheets[sheetName];
		// Use raw: true to get actual numbers, not formatted strings
		const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
		if (rows.length < 2) continue;

		const { year, account } = parseSheetName(sheetName);

		// Try to find headers in first few rows
		let headerMapping: Record<number, string> | null = null;
		let headerRow = 0;
		for (let r = 0; r < Math.min(5, rows.length); r++) {
			headerMapping = detectHeaders(rows[r] as unknown[]);
			if (headerMapping) { headerRow = r; break; }
		}
		if (!headerMapping) continue;

		for (let r = headerRow + 1; r < rows.length; r++) {
			const row = rows[r] as unknown[];
			if (!row || row.every(c => c == null || c === '')) continue;

			const getVal = (field: string): unknown => {
				for (const [idx, name] of Object.entries(headerMapping!)) {
					if (name === field) return row[Number(idx)];
				}
				return undefined;
			};

			const getStr = (field: string): string => {
				const v = getVal(field);
				return v != null ? String(v).trim() : '';
			};

			const dateVal = getVal('date');
			const date = parseDate(dateVal);
			if (!date) continue;

			const debit = parseNumber(getVal('debit'));
			const credit = parseNumber(getVal('credit'));
			const balance = parseNumber(getVal('balance'));
			const tag = getStr('tag');
			const txType = getStr('type');
			const type: 'Credit' | 'Debit' = txType.toLowerCase() === 'credit' ? 'Credit' : 'Debit';

			transactions.push({
				id: `${fileName}-${sheetName}-${batch}-${globalId++}`,
				date,
				description: getStr('description'),
				description2: getStr('description2'),
				debit,
				credit,
				balance,
				currency: getStr('currency') || 'EUR',
				type,
				txType: txType.toUpperCase(),
				tag: tag || 'UNTAGGED',
				notes: getStr('notes'),
				sourceSheet: sheetName,
				account,
				year: year || date.getFullYear(),
				fileName
			});
		}
	}

	return transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function getUniqueValues(transactions: Transaction[], field: keyof Transaction): string[] {
	const set = new Set<string>();
	for (const t of transactions) {
		const val = String(t[field] ?? '');
		if (val) set.add(val);
	}
	return [...set].sort();
}
