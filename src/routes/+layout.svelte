<script lang="ts">
	import '../app.css';
	let { children, data } = $props();
</script>

<svelte:head>
	<title>TagLedger</title>
</svelte:head>

<div class="min-h-screen bg-[var(--bg-primary)]">
	{#if data.user}
		<header class="flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
			<div class="flex items-center gap-3">
				<h1 class="text-lg font-semibold text-[var(--text-primary)]">TagLedger</h1>
			</div>
			<div class="flex items-center gap-3">
				<span class="text-sm text-[var(--text-secondary)]">{data.user.email}</span>
				{#if data.user.picture}
					<img src={data.user.picture} alt="" class="w-7 h-7 rounded-full" referrerpolicy="no-referrer" />
				{/if}
				<a href="/api/auth/logout" class="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Logout</a>
			</div>
		</header>
	{/if}
	{@render children()}
</div>
