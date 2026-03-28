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
		// Check URL for token from auth callback
		const params = new URLSearchParams(window.location.search);
		const token = params.get('token');
		if (token) {
			setSessionToken(token);
			// Clean URL
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
	setContext('user', user);
</script>

<svelte:head>
	<title>TagLedger</title>
</svelte:head>

<div class="min-h-screen bg-[var(--bg-primary)]">
	{#if $user}
		<header class="flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
			<div class="flex items-center gap-3">
				<h1 class="text-lg font-semibold text-[var(--text-primary)]">TagLedger</h1>
			</div>
			<div class="flex items-center gap-3">
				<span class="text-sm text-[var(--text-secondary)]">{$user.email}</span>
				{#if $user.picture}
					<img src={$user.picture} alt="" class="w-7 h-7 rounded-full" referrerpolicy="no-referrer" />
				{/if}
				<button onclick={handleLogout} class="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Logout</button>
			</div>
		</header>
	{/if}
	{#if initialized}
		{@render children()}
	{/if}
</div>
