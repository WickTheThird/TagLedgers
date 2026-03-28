import { writable, derived } from 'svelte/store';
import type { Transaction, FilterState, TagSummary, PnLGroup, AutoTagRule } from '../types';

export const transactions = writable<Transaction[]>([]);
export const autoTagRules = writable<AutoTagRule[]>([]);
export const loadedFiles = writable<string[]>([]);

// Track loaded file metadata: driveFileId -> { name, driveId }
export interface LoadedFileMeta {
	driveId: string;
	name: string;
}
export const loadedFileMeta = writable<LoadedFileMeta[]>([]);

// Derived: for each loaded file, which sheets does it contain?
export const fileSheetMap = derived(
	[transactions, loadedFileMeta],
	([$transactions, $loadedFileMeta]) => {
		const map = new Map<string, { driveId: string; name: string; sheets: string[] }>();
		for (const meta of $loadedFileMeta) {
			const sheets = [...new Set(
				$transactions.filter(t => t.fileName === meta.name).map(t => t.sourceSheet)
			)].sort();
			map.set(meta.name, { driveId: meta.driveId, name: meta.name, sheets });
		}
		return map;
	}
);

export function updateTransactionTag(txId: string, newTag: string) {
	transactions.update(txs => txs.map(t => t.id === txId ? { ...t, tag: newTag, type: inferType(t, newTag) } : t));
}

export function addTransaction(tx: Transaction) {
	transactions.update(txs => [...txs, tx]);
}

export function deleteTransaction(txId: string) {
	transactions.update(txs => txs.filter(t => t.id !== txId));
}

function inferType(t: Transaction, tag: string): 'Credit' | 'Debit' {
	if (t.credit && t.credit > 0) return 'Credit';
	if (t.debit && t.debit > 0) return 'Debit';
	return t.type;
}

export const filters = writable<FilterState>({
	dateFrom: '',
	dateTo: '',
	accounts: [],
	tags: [],
	types: [],
	sheets: [],
	search: ''
});

export const filteredTransactions = derived(
	[transactions, filters],
	([$transactions, $filters]) => {
		return $transactions.filter(t => {
			if ($filters.dateFrom && t.date < new Date($filters.dateFrom)) return false;
			if ($filters.dateTo && t.date > new Date($filters.dateTo + 'T23:59:59')) return false;
			if ($filters.accounts.length && !$filters.accounts.includes(t.account)) return false;
			if ($filters.tags.length && !$filters.tags.includes(t.tag)) return false;
			if ($filters.types.length && !$filters.types.includes(t.type)) return false;
			if ($filters.sheets.length && !$filters.sheets.includes(t.sourceSheet)) return false;
			if ($filters.search) {
				const s = $filters.search.toLowerCase();
				if (
					!t.description.toLowerCase().includes(s) &&
					!t.description2.toLowerCase().includes(s) &&
					!t.notes.toLowerCase().includes(s) &&
					!t.tag.toLowerCase().includes(s)
				) return false;
			}
			return true;
		});
	}
);

export const tagSummaries = derived(filteredTransactions, ($filtered) => {
	const map = new Map<string, TagSummary>();
	for (const t of $filtered) {
		let s = map.get(t.tag);
		if (!s) {
			s = { tag: t.tag, totalDebit: 0, totalCredit: 0, net: 0, count: 0 };
			map.set(t.tag, s);
		}
		if (t.debit) s.totalDebit += t.debit;
		if (t.credit) s.totalCredit += t.credit;
		s.net = s.totalCredit - s.totalDebit;
		s.count++;
	}
	return [...map.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
});

export const pnlData = derived(filteredTransactions, ($filtered) => {
	const groups = new Map<string, { revenue: Map<string, { amount: number; count: number }>; expenses: Map<string, { amount: number; count: number }> }>();

	for (const t of $filtered) {
		const groupKey = t.account;
		if (!groups.has(groupKey)) {
			groups.set(groupKey, { revenue: new Map(), expenses: new Map() });
		}
		const g = groups.get(groupKey)!;

		if (t.type === 'Credit' && t.credit) {
			const existing = g.revenue.get(t.tag) ?? { amount: 0, count: 0 };
			existing.amount += t.credit;
			existing.count++;
			g.revenue.set(t.tag, existing);
		} else if (t.type === 'Debit' && t.debit) {
			const existing = g.expenses.get(t.tag) ?? { amount: 0, count: 0 };
			existing.amount += t.debit;
			existing.count++;
			g.expenses.set(t.tag, existing);
		}
	}

	const result: PnLGroup[] = [];
	for (const [name, g] of groups) {
		const revenue = [...g.revenue.entries()].map(([tag, d]) => ({ tag, ...d })).sort((a, b) => b.amount - a.amount);
		const expenses = [...g.expenses.entries()].map(([tag, d]) => ({ tag, ...d })).sort((a, b) => b.amount - a.amount);
		const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
		const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
		result.push({
			name,
			revenue,
			expenses,
			totalRevenue,
			totalExpenses,
			netIncome: totalRevenue - totalExpenses
		});
	}
	return result.sort((a, b) => b.netIncome - a.netIncome);
});

export const availableAccounts = derived(transactions, ($t) => [...new Set($t.map(t => t.account))].sort());
export const availableTags = derived(transactions, ($t) => [...new Set($t.map(t => t.tag))].sort());
export const availableYears = derived(transactions, ($t) => [...new Set($t.map(t => t.year))].sort());
export const availableSheets = derived(transactions, ($t) => [...new Set($t.map(t => t.sourceSheet))].sort());

export const totalStats = derived(filteredTransactions, ($filtered) => {
	let totalDebit = 0;
	let totalCredit = 0;
	for (const t of $filtered) {
		if (t.debit) totalDebit += t.debit;
		if (t.credit) totalCredit += t.credit;
	}
	return { totalDebit, totalCredit, net: totalCredit - totalDebit, count: $filtered.length };
});
