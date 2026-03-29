import type { Transaction, TransferMatch } from './types';

// --- Description Normalization ---

const NOISE_WORDS = new Set([
	'sepa', 'credit', 'transfer', 'payment', 'apple', 'pay', 'top-up',
	'by', 'to', 'from', 'the', 'of', 'for', 'a', 'an', 'via', 'uab',
	'bank', 'ltd', 'limited', 'inc', 'srl', 'sa'
]);

const TRANSFER_KEYWORDS = new Set([
	'transfer', 'top-up', 'topup', 'revolut', 'boi', 'sepa',
	'wire', 'internal', 'between', 'accounts'
]);

function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function extractTokens(text: string): Set<string> {
	const normalized = normalizeText(text);
	const tokens = new Set<string>();
	for (const word of normalized.split(' ')) {
		if (word.length > 1 && !NOISE_WORDS.has(word)) {
			tokens.add(word);
		}
	}
	return tokens;
}

function hasTransferKeywords(text: string): boolean {
	const lower = text.toLowerCase();
	for (const kw of TRANSFER_KEYWORDS) {
		if (lower.includes(kw)) return true;
	}
	return false;
}

// --- Scoring Functions ---

function scoreAmount(debitAmount: number, creditAmount: number): number {
	const diff = Math.abs(debitAmount - creditAmount);
	if (diff < 0.005) return 50;   // exact match
	if (diff <= 0.01) return 45;   // rounding tolerance
	return -1; // reject
}

function scoreDateCloseness(dateA: Date, dateB: Date): number {
	const diffMs = Math.abs(dateA.getTime() - dateB.getTime());
	const diffDays = diffMs / (86400 * 1000);

	if (diffDays < 0.5) return 25;   // same day
	if (diffDays <= 1.5) return 22;  // 1 day
	if (diffDays <= 2.5) return 18;  // 2 days
	if (diffDays <= 3.5) return 14;  // 3 days
	if (diffDays <= 5.5) return 8;   // 4-5 days
	if (diffDays <= 7.5) return 4;   // 6-7 days
	return -1; // reject
}

const TRANSFER_TX_TYPES = new Set([
	'TOPUP', 'TRANSFER', 'INTERNAL', 'WIRE', 'SEPA',
	'BANK TRANSFER', 'STANDING ORDER'
]);

function scoreDescription(
	descA: string, descB: string,
	accountA: string, accountB: string,
	txTypeA: string, txTypeB: string,
	tagA: string, tagB: string
): number {
	let score = 0;
	const maxScore = 15;

	// Transaction type signals (TOPUP, TRANSFER, etc.) — strongest metadata signal
	if (TRANSFER_TX_TYPES.has(txTypeA.toUpperCase())) score += 5;
	if (TRANSFER_TX_TYPES.has(txTypeB.toUpperCase())) score += 5;

	// Tag signals (e.g., "Business transfer between accounts")
	const transferTagPattern = /transfer|between\s*accounts/i;
	if (transferTagPattern.test(tagA)) score += 3;
	if (transferTagPattern.test(tagB)) score += 3;

	// Account name cross-reference in description
	const lowerA = (descA + ' ').toLowerCase();
	const lowerB = (descB + ' ').toLowerCase();
	const lowerAccA = accountA.toLowerCase();
	const lowerAccB = accountB.toLowerCase();
	if (lowerAccB.length > 2 && lowerA.includes(lowerAccB)) score += 4;
	if (lowerAccA.length > 2 && lowerB.includes(lowerAccA)) score += 4;

	// Transfer keywords in descriptions
	if (hasTransferKeywords(descA)) score += 2;
	if (hasTransferKeywords(descB)) score += 2;

	// Token overlap
	const tokensA = extractTokens(descA);
	const tokensB = extractTokens(descB);
	if (tokensA.size > 0 && tokensB.size > 0) {
		let overlap = 0;
		for (const t of tokensA) {
			if (tokensB.has(t)) overlap++;
		}
		const overlapRatio = overlap / Math.max(tokensA.size, tokensB.size);
		score += Math.round(overlapRatio * 3);
	}

	return Math.min(score, maxScore);
}

function scoreAccountPairFrequency(
	accountA: string,
	accountB: string,
	pairCounts: Map<string, number>
): number {
	const key = [accountA, accountB].sort().join('|');
	const count = pairCounts.get(key) ?? 0;
	// More matches between same pair = higher confidence
	if (count >= 5) return 10;
	if (count >= 3) return 7;
	if (count >= 1) return 4;
	return 0;
}

// --- Candidate Generation ---

interface ScoredCandidate {
	debit: Transaction;
	credit: Transaction;
	score: number;
	amountScore: number;
	dateScore: number;
	descScore: number;
	pairScore: number;
}

// --- Main Detection ---

export function detectInterAccountTransfers(txs: Transaction[]): TransferMatch[] {
	if (txs.length === 0) return [];

	// Group by currency
	const byCurrency = new Map<string, Transaction[]>();
	for (const t of txs) {
		const cur = t.currency.toUpperCase();
		if (!byCurrency.has(cur)) byCurrency.set(cur, []);
		byCurrency.get(cur)!.push(t);
	}

	const allCandidates: ScoredCandidate[] = [];

	for (const [, group] of byCurrency) {
		const debits = group.filter(t => t.debit != null && t.debit > 0);
		const credits = group.filter(t => t.credit != null && t.credit > 0);

		if (debits.length === 0 || credits.length === 0) continue;

		// First pass: count account pair frequency for pair scoring
		const pairCounts = new Map<string, number>();

		// Generate all candidate pairs with hard filters + scoring
		for (const d of debits) {
			for (const c of credits) {
				// Hard filters
				if (d.account === c.account) continue;
				if (d.currency.toUpperCase() !== c.currency.toUpperCase()) continue;

				const amountScore = scoreAmount(d.debit!, c.credit!);
				if (amountScore < 0) continue;

				const dateScore = scoreDateCloseness(d.date, c.date);
				if (dateScore < 0) continue;

				const descScore = scoreDescription(
					`${d.description} ${d.description2}`,
					`${c.description} ${c.description2}`,
					d.account, c.account,
					d.txType, c.txType,
					d.tag, c.tag
				);

				// Count this pair for frequency scoring
				const pairKey = [d.account, c.account].sort().join('|');
				pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);

				allCandidates.push({
					debit: d, credit: c,
					score: 0, // calculated after pair counting
					amountScore, dateScore, descScore, pairScore: 0
				});
			}
		}

		// Second pass: add pair frequency scores
		for (const cand of allCandidates) {
			cand.pairScore = scoreAccountPairFrequency(
				cand.debit.account, cand.credit.account, pairCounts
			);
			cand.score = cand.amountScore + cand.dateScore + cand.descScore + cand.pairScore;
		}
	}

	// One-to-one assignment: sort by score desc, assign top-down
	allCandidates.sort((a, b) => b.score - a.score);

	const usedIds = new Set<string>();
	const matches: TransferMatch[] = [];

	for (const cand of allCandidates) {
		if (usedIds.has(cand.debit.id) || usedIds.has(cand.credit.id)) continue;
		if (cand.score < 40) continue; // below threshold

		usedIds.add(cand.debit.id);
		usedIds.add(cand.credit.id);

		const confidence = cand.score >= 70 ? 'high' : 'medium';

		matches.push({
			id: `xfer-${matches.length}`,
			debitTxId: cand.debit.id,
			creditTxId: cand.credit.id,
			amount: cand.debit.debit!,
			currency: cand.debit.currency,
			score: cand.score,
			confidence,
			status: 'auto'
		});
	}

	return matches;
}
