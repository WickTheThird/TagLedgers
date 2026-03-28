<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { apiFetch, apiUrl } from '$lib/api';
	import { writable } from 'svelte/store';

	let { children } = $props();

	// Global user state
	const user = writable<{ email: string; name: string; picture: string } | null>(null);
	let initialized = $state(false);

	onMount(async () => {
		try {
			const res = await apiFetch('/api/auth/me');
			if (res.ok) {
				const data = await res.json();
				user.set(data.user);
			}
		} catch {}
		initialized = true;
	});

	// Export user store globally
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
				<a href={apiUrl('/api/auth/logout')} class="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Logout</a>
			</div>
		</header>
	{/if}
	{#if initialized}
		{@render children()}
	{/if}
</div>
