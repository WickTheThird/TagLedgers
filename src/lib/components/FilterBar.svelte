<script lang="ts">
	import { filters, availableAccounts, availableTags, availableSheets, totalStats } from '$lib/stores/transactions';
	import FilterPopup from './FilterPopup.svelte';

	let activePopup = $state<string | null>(null);

	function togglePopup(name: string) {
		activePopup = activePopup === name ? null : name;
	}

	function clearFilters() {
		$filters = { dateFrom: '', dateTo: '', accounts: [], tags: [], types: [], sheets: [], search: '' };
	}

	function removeAccount(acc: string) {
		$filters.accounts = $filters.accounts.filter(a => a !== acc);
	}
	function removeTag(tag: string) {
		$filters.tags = $filters.tags.filter(t => t !== tag);
	}
	function removeSheet(sheet: string) {
		$filters.sheets = $filters.sheets.filter(s => s !== sheet);
	}
	function removeType(type: 'Credit' | 'Debit') {
		$filters.types = $filters.types.filter(t => t !== type);
	}

	let hasAnyFilter = $derived(
		$filters.dateFrom || $filters.dateTo || $filters.accounts.length ||
		$filters.tags.length || $filters.types.length || $filters.sheets.length || $filters.search
	);

	function formatCurrency(n: number) {
		return n.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.filter-popup-container')) {
			activePopup = null;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="bg-[var(--bg-secondary)] border-b border-[var(--border)] px-4 py-3">
	<div class="flex items-center gap-2 flex-wrap">
		<!-- Date filters -->
		<div class="flex items-center gap-1">
			<input
				type="date"
				bind:value={$filters.dateFrom}
				class="bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded px-2 py-1.5 focus:border-[var(--accent)] outline-none"
			/>
			<span class="text-[var(--text-muted)] text-sm">to</span>
			<input
				type="date"
				bind:value={$filters.dateTo}
				class="bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded px-2 py-1.5 focus:border-[var(--accent)] outline-none"
			/>
		</div>

		<!-- Account filter -->
		<div class="relative filter-popup-container">
			<button
				onclick={() => togglePopup('accounts')}
				class="bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm rounded px-3 py-1.5 hover:border-[var(--accent)] transition-colors"
				class:border-[var(--accent)]={$filters.accounts.length > 0}
				class:text-[var(--accent)]={$filters.accounts.length > 0}
			>
				Account {$filters.accounts.length ? `(${$filters.accounts.length})` : ''}
			</button>
			{#if activePopup === 'accounts'}
				<FilterPopup
					options={$availableAccounts}
					selected={$filters.accounts}
					onchange={(val) => { $filters.accounts = val; }}
				/>
			{/if}
		</div>

		<!-- Tag filter -->
		<div class="relative filter-popup-container">
			<button
				onclick={() => togglePopup('tags')}
				class="bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm rounded px-3 py-1.5 hover:border-[var(--accent)] transition-colors"
				class:border-[var(--accent)]={$filters.tags.length > 0}
				class:text-[var(--accent)]={$filters.tags.length > 0}
			>
				Tag {$filters.tags.length ? `(${$filters.tags.length})` : ''}
			</button>
			{#if activePopup === 'tags'}
				<FilterPopup
					options={$availableTags}
					selected={$filters.tags}
					onchange={(val) => { $filters.tags = val; }}
				/>
			{/if}
		</div>

		<!-- Type filter -->
		<div class="relative filter-popup-container">
			<button
				onclick={() => togglePopup('types')}
				class="bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm rounded px-3 py-1.5 hover:border-[var(--accent)] transition-colors"
				class:border-[var(--accent)]={$filters.types.length > 0}
				class:text-[var(--accent)]={$filters.types.length > 0}
			>
				Type {$filters.types.length ? `(${$filters.types.length})` : ''}
			</button>
			{#if activePopup === 'types'}
				<FilterPopup
					options={['Credit', 'Debit']}
					selected={$filters.types}
					onchange={(val) => { $filters.types = val as ('Credit' | 'Debit')[]; }}
				/>
			{/if}
		</div>

		<!-- Sheet filter -->
		<div class="relative filter-popup-container">
			<button
				onclick={() => togglePopup('sheets')}
				class="bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm rounded px-3 py-1.5 hover:border-[var(--accent)] transition-colors"
				class:border-[var(--accent)]={$filters.sheets.length > 0}
				class:text-[var(--accent)]={$filters.sheets.length > 0}
			>
				Sheet {$filters.sheets.length ? `(${$filters.sheets.length})` : ''}
			</button>
			{#if activePopup === 'sheets'}
				<FilterPopup
					options={$availableSheets}
					selected={$filters.sheets}
					onchange={(val) => { $filters.sheets = val; }}
				/>
			{/if}
		</div>

		<!-- Search -->
		<input
			type="text"
			placeholder="Search descriptions..."
			bind:value={$filters.search}
			class="bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded px-3 py-1.5 focus:border-[var(--accent)] outline-none flex-1 min-w-[200px]"
		/>

		{#if hasAnyFilter}
			<button onclick={clearFilters} class="text-sm text-[var(--text-muted)] hover:text-[var(--red)] transition-colors">
				Clear all
			</button>
		{/if}
	</div>

	<!-- Active filter chips -->
	{#if hasAnyFilter}
		<div class="flex items-center gap-1.5 mt-2 flex-wrap">
			{#each $filters.accounts as acc}
				<span class="inline-flex items-center gap-1 bg-[var(--accent)]/20 text-[var(--accent)] text-xs px-2 py-0.5 rounded-full">
					{acc}
					<button onclick={() => removeAccount(acc)} class="hover:text-white">&times;</button>
				</span>
			{/each}
			{#each $filters.tags as tag}
				<span class="inline-flex items-center gap-1 bg-[var(--orange)]/20 text-[var(--orange)] text-xs px-2 py-0.5 rounded-full">
					{tag}
					<button onclick={() => removeTag(tag)} class="hover:text-white">&times;</button>
				</span>
			{/each}
			{#each $filters.types as type}
				<span
					class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full {type === 'Credit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}"
				>
					{type}
					<button onclick={() => removeType(type)} class="hover:text-white">&times;</button>
				</span>
			{/each}
			{#each $filters.sheets as sheet}
				<span class="inline-flex items-center gap-1 bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full">
					{sheet}
					<button onclick={() => removeSheet(sheet)} class="hover:text-white">&times;</button>
				</span>
			{/each}
		</div>
	{/if}

	<!-- Stats bar -->
	<div class="flex items-center gap-6 mt-2 text-xs text-[var(--text-muted)]">
		<span>{$totalStats.count} transactions</span>
		<span class="text-[var(--green)]">Credit: {formatCurrency($totalStats.totalCredit)}</span>
		<span class="text-[var(--red)]">Debit: {formatCurrency($totalStats.totalDebit)}</span>
		<span class:text-[var(--green)]={$totalStats.net >= 0} class:text-[var(--red)]={$totalStats.net < 0}>
			Net: {formatCurrency($totalStats.net)}
		</span>
	</div>
</div>
