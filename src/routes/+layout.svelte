<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { apiFetch, apiUrl, getSessionToken, setSessionToken, clearSessionToken } from '$lib/api';
	import { writable } from 'svelte/store';
	import { goto } from '$app/navigation';

	let { children } = $props();

	const user = writable<{ email: string; name: string; picture: string } | null>(null);
	let initialized = $state(false);

	function handleLogout() {
		clearSessionToken();
		user.set(null);
		goto('/login');
	}

	onMount(async () => {
		// Check hash fragment for token (from Worker auth redirect)
		const hash = window.location.hash;
		if (hash.startsWith('#token=')) {
			const token = decodeURIComponent(hash.slice(7));
			setSessionToken(token);
			window.history.replaceState({}, '', window.location.pathname);
		}
		// Also support legacy ?token= param as fallback
		const params = new URLSearchParams(window.location.search);
		const queryToken = params.get('token');
		if (queryToken) {
			setSessionToken(queryToken);
			window.history.replaceState({}, '', window.location.pathname);
		}

		// Check if we have a valid session
		if (getSessionToken()) {
			try {
				const res = await apiFetch('/api/auth/me');
				if (res.ok) {
					const data = await res.json();
					user.set(data.user);
				} else {
					clearSessionToken();
				}
			} catch {
				clearSessionToken();
			}
		}
		initialized = true;
	});

	import { setContext } from 'svelte';
	import { displayCurrency, detectedCurrencies, fetchExchangeRates, getCurrencySymbol } from '$lib/stores/currency';
	import { transactions } from '$lib/stores/transactions';

	setContext('user', user);

	// Auto-detect currencies from loaded transactions
	$effect(() => {
		const currencies = [...new Set($transactions.map(t => t.currency.toUpperCase()))].filter(Boolean).sort();
		if (currencies.length) detectedCurrencies.set(currencies);
	});

	// Fetch exchange rates on load
	onMount(async () => {
		await fetchExchangeRates('EUR');
	});
</script>

<svelte:head>
	<title>TagLedger</title>
</svelte:head>

<div class="min-h-screen bg-[var(--bg-primary)]">
	{#if $user}
		<header class="flex items-center justify-between px-2 sm:px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
			<div class="flex items-center gap-2">
				<h1 class="text-base sm:text-lg font-semibold text-[var(--text-primary)]">TagLedger</h1>
			</div>
			<div class="flex items-center gap-2 sm:gap-3">
				<select
					bind:value={$displayCurrency}
					onchange={() => fetchExchangeRates($displayCurrency)}
					class="bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded px-1.5 py-1 outline-none focus:border-[var(--accent)]"
					title="Display currency"
				>
					{#each $detectedCurrencies as cur}
						<option value={cur}>{getCurrencySymbol(cur)} {cur}</option>
					{/each}
					{#if !$detectedCurrencies.includes('EUR')}
						<option value="EUR">€ EUR</option>
					{/if}
					{#if !$detectedCurrencies.includes('USD')}
						<option value="USD">$ USD</option>
					{/if}
					{#if !$detectedCurrencies.includes('GBP')}
						<option value="GBP">£ GBP</option>
					{/if}
					{#if !$detectedCurrencies.includes('RON')}
						<option value="RON">lei RON</option>
					{/if}
				</select>
				<span class="hidden sm:inline text-sm text-[var(--text-secondary)]">{$user.email}</span>
				{#if $user.picture}
					<img src={$user.picture} alt="" class="w-7 h-7 rounded-full" referrerpolicy="no-referrer" />
				{/if}
				<button onclick={handleLogout} class="text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Logout</button>
			</div>
		</header>
	{/if}
	{#if initialized}
		{@render children()}
	{/if}
	<footer class="text-center text-xs text-[var(--text-muted)] py-3 border-t border-[var(--border)]">
		<a href="/privacy" class="underline hover:text-[var(--text-secondary)]">Privacy Policy</a>
		&middot;
		<a href="/terms" class="underline hover:text-[var(--text-secondary)]">Terms of Service</a>
	</footer>
</div>
