<script lang="ts">
	import { filters, availableAccounts, availableTags, availableSheets, totalStats, transferMatches } from '$lib/stores/transactions';
	import FilterPopup from './FilterPopup.svelte';
	import { displayCurrency, formatWithCurrency, convertAmount, exchangeRates } from '$lib/stores/currency';

	let activePopup = $state<string | null>(null);

	function togglePopup(name: string) {
		activePopup = activePopup === name ? null : name;
	}

	function clearFilters() {
		$filters = { dateFrom: '', dateTo: '', accounts: [], tags: [], types: [], sheets: [], search: '', transferFilter: $filters.transferFilter };
	}

	function cycleTransferFilter() {
		const cycle = { all: 'only', only: 'exclude', exclude: 'all' } as const;
		$filters.transferFilter = cycle[$filters.transferFilter];
	}

	let activeMatches = $derived($transferMatches.filter(m => m.status !== 'rejected'));
	let highConfMatches = $derived(activeMatches.filter(m => m.confidence === 'high' || m.status === 'confirmed'));
	let suggestedMatches = $derived(activeMatches.filter(m => m.confidence === 'medium' && m.status === 'auto'));
	let transferTotal = $derived(
		highConfMatches.reduce((sum, m) => sum + convertAmount(m.amount, m.currency, $displayCurrency, $exchangeRates), 0)
	);

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

	let activeDatePreset = $state<string>('');

	function setDatePreset(preset: string) {
		const now = new Date();
		const y = now.getFullYear();
		const m = now.getMonth();
		let from = '', to = '';

		switch (preset) {
			case 'thisMonth':
				from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
				to = new Date(y, m + 1, 0).toISOString().split('T')[0];
				break;
			case 'lastMonth': {
				const lm = m === 0 ? 11 : m - 1;
				const ly = m === 0 ? y - 1 : y;
				from = `${ly}-${String(lm + 1).padStart(2, '0')}-01`;
				to = new Date(ly, lm + 1, 0).toISOString().split('T')[0];
				break;
			}
			case 'thisQuarter': {
				const qStart = Math.floor(m / 3) * 3;
				from = `${y}-${String(qStart + 1).padStart(2, '0')}-01`;
				to = new Date(y, qStart + 3, 0).toISOString().split('T')[0];
				break;
			}
			case 'thisYear':
				from = `${y}-01-01`;
				to = `${y}-12-31`;
				break;
			case 'lastYear':
				from = `${y - 1}-01-01`;
				to = `${y - 1}-12-31`;
				break;
			case 'all':
				from = '';
				to = '';
				break;
		}
		$filters.dateFrom = from;
		$filters.dateTo = to;
		activeDatePreset = preset;
	}

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

<div class="bg-[var(--bg-secondary)] border-b border-[var(--border)] px-3 sm:px-4 py-2 sm:py-3">
	<div class="flex items-center gap-2 flex-wrap">
		<!-- Date filter -->
		<div class="relative filter-popup-container">
			<button
				onclick={() => togglePopup('dates')}
				class="bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm rounded px-3 py-1.5 hover:border-[var(--accent)] transition-colors"
				class:border-[var(--accent)]={$filters.dateFrom || $filters.dateTo}
				class:text-[var(--accent)]={$filters.dateFrom || $filters.dateTo}
			>
				{#if $filters.dateFrom && $filters.dateTo}
					{$filters.dateFrom} — {$filters.dateTo}
				{:else if $filters.dateFrom}
					From {$filters.dateFrom}
				{:else if $filters.dateTo}
					Until {$filters.dateTo}
				{:else}
					Date range
				{/if}
			</button>
			{#if activePopup === 'dates'}
				<div class="absolute top-full left-0 mt-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg shadow-xl z-50 p-3 min-w-[280px]">
					<div class="grid grid-cols-3 gap-1 mb-3">
						{#each [
							{ key: 'thisMonth', label: 'This Month' },
							{ key: 'lastMonth', label: 'Last Month' },
							{ key: 'thisQuarter', label: 'This Quarter' },
							{ key: 'thisYear', label: 'This Year' },
							{ key: 'lastYear', label: 'Last Year' },
							{ key: 'all', label: 'All Time' },
						] as { key, label }}
							<button
								onclick={() => { setDatePreset(key); activePopup = null; }}
								class="text-xs px-2 py-1.5 rounded transition-colors {activeDatePreset === key ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'}"
							>
								{label}
							</button>
						{/each}
					</div>
					<div class="border-t border-[var(--border)] pt-2">
						<div class="flex items-center gap-2">
							<div class="flex-1">
								<label class="text-[10px] text-[var(--text-muted)] block mb-0.5">From</label>
								<input
									type="date"
									bind:value={$filters.dateFrom}
									onchange={() => { activeDatePreset = ''; }}
									class="w-full bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded px-2 py-1 focus:border-[var(--accent)] outline-none"
								/>
							</div>
							<div class="flex-1">
								<label class="text-[10px] text-[var(--text-muted)] block mb-0.5">To</label>
								<input
									type="date"
									bind:value={$filters.dateTo}
									onchange={() => { activeDatePreset = ''; }}
									class="w-full bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded px-2 py-1 focus:border-[var(--accent)] outline-none"
								/>
							</div>
						</div>
					</div>
					{#if $filters.dateFrom || $filters.dateTo}
						<button
							onclick={() => { $filters.dateFrom = ''; $filters.dateTo = ''; activeDatePreset = ''; activePopup = null; }}
							class="text-xs text-[var(--text-muted)] hover:text-[var(--red)] mt-2 transition-colors"
						>
							Clear dates
						</button>
					{/if}
				</div>
			{/if}
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

		<!-- Transfer filter (cycles: all → only → exclude → all) -->
		{#if activeMatches.length > 0}
			<button
				onclick={cycleTransferFilter}
				class="bg-[var(--bg-tertiary)] border text-sm rounded px-3 py-1.5 transition-colors"
				class:border-cyan-500={$filters.transferFilter !== 'all'}
				class:text-cyan-400={$filters.transferFilter !== 'all'}
				class:border-[var(--border)]={$filters.transferFilter === 'all'}
				title={
					$filters.transferFilter === 'all' ? 'Click to show only transfers' :
					$filters.transferFilter === 'only' ? 'Click to exclude transfers from P&L' :
					'Click to show all transactions'
				}
			>
				{#if $filters.transferFilter === 'only'}
					Showing Transfers ({activeMatches.length})
				{:else if $filters.transferFilter === 'exclude'}
					Transfers Excluded ({activeMatches.length})
				{:else}
					Transfers ({activeMatches.length})
				{/if}
				{#if suggestedMatches.length && $filters.transferFilter === 'all'}
					 · {suggestedMatches.length} to review
				{/if}
			</button>
		{/if}

		<!-- Search -->
		<input
			type="text"
			placeholder="Search descriptions..."
			bind:value={$filters.search}
			class="bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded px-3 py-1.5 focus:border-[var(--accent)] outline-none flex-1 min-w-0 w-full sm:min-w-[200px] sm:w-auto"
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
	<div class="flex items-center flex-wrap gap-2 sm:gap-6 mt-2 text-[10px] sm:text-xs text-[var(--text-muted)]">
		<span>{$totalStats.count} transactions</span>
		<span class="text-[var(--green)]">Credit: {formatWithCurrency($totalStats.totalCredit, $displayCurrency)}</span>
		<span class="text-[var(--red)]">Debit: {formatWithCurrency($totalStats.totalDebit, $displayCurrency)}</span>
		<span class:text-[var(--green)]={$totalStats.net >= 0} class:text-[var(--red)]={$totalStats.net < 0}>
			Net: {formatWithCurrency($totalStats.net, $displayCurrency)}
		</span>
		{#if activeMatches.length > 0}
			<span class="text-cyan-400">
				{activeMatches.length} transfers ({formatWithCurrency(transferTotal, $displayCurrency)})
				{#if $filters.transferFilter === 'exclude'} — excluded{/if}
				{#if $filters.transferFilter === 'only'} — showing{/if}
			</span>
		{/if}
	</div>
</div>
