import { writable, derived, get } from 'svelte/store';

export const displayCurrency = writable<string>('EUR');
export const exchangeRates = writable<Record<string, number>>({ EUR: 1 });
export const ratesLoading = writable(false);
export const ratesError = writable('');
export const lastRatesFetch = writable<string>('');

// Available currencies detected from loaded transactions
export const detectedCurrencies = writable<string[]>(['EUR']);

// Currency symbols map
const SYMBOLS: Record<string, string> = {
	EUR: '\u20AC', USD: '$', GBP: '\u00A3', RON: 'lei', CHF: 'CHF',
	JPY: '\u00A5', CAD: 'C$', AUD: 'A$', SEK: 'kr', NOK: 'kr',
	DKK: 'kr', PLN: 'z\u0142', CZK: 'K\u010D', HUF: 'Ft', BGN: 'лв',
	HRK: 'kn', TRY: '\u20BA', RUB: '\u20BD', INR: '\u20B9', BRL: 'R$',
};

export function getCurrencySymbol(code: string): string {
	return SYMBOLS[code.toUpperCase()] || code;
}

export function convertAmount(amount: number, fromCurrency: string, toCurrency: string, rates: Record<string, number>): number {
	if (fromCurrency === toCurrency) return amount;
	const fromRate = rates[fromCurrency.toUpperCase()];
	const toRate = rates[toCurrency.toUpperCase()];
	if (!fromRate || !toRate) return amount; // no rate available, return as-is
	return (amount / fromRate) * toRate;
}

export async function fetchExchangeRates(baseCurrency: string = 'EUR'): Promise<void> {
	ratesLoading.set(true);
	ratesError.set('');
	try {
		// Using frankfurter.app — free, no API key, supports ECB rates
		const res = await fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}`);
		if (!res.ok) throw new Error('Failed to fetch rates');
		const data = await res.json();
		const rates: Record<string, number> = { [baseCurrency]: 1, ...data.rates };
		exchangeRates.set(rates);
		lastRatesFetch.set(new Date().toLocaleString());
	} catch (e: any) {
		ratesError.set(e.message || 'Failed to fetch exchange rates');
	} finally {
		ratesLoading.set(false);
	}
}

// Format amount with currency
export function formatWithCurrency(amount: number, currency: string): string {
	const sym = getCurrencySymbol(currency);
	const formatted = Math.abs(amount).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	const sign = amount < 0 ? '-' : '';
	// Put symbol before for most currencies, after for some
	const symbolAfter = ['RON', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF'].includes(currency.toUpperCase());
	return symbolAfter ? `${sign}${formatted} ${sym}` : `${sign}${sym}${formatted}`;
}
