<script lang="ts">
	import { goto } from '$app/navigation';
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import { transactions, filteredTransactions } from '$lib/stores/transactions';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import TransactionTable from '$lib/components/TransactionTable.svelte';
	import TagSummary from '$lib/components/TagSummary.svelte';
	import PnLView from '$lib/components/PnLView.svelte';
	import FileSelector from '$lib/components/FileSelector.svelte';
	import * as XLSX from 'xlsx';

	const user = getContext<Writable<{ email: string; name: string; picture: string } | null>>('user');
	let activeTab = $state<'table' | 'pnl'>('table');

	$effect(() => {
		if (!$user) goto('/login');
	});

	function exportFiltered() {
		const data = $filteredTransactions.map(t => ({
			Date: t.date.toLocaleDateString('en-IE'),
			Description: t.description,
			'Description 2': t.description2,
			Tag: t.tag,
			Debit: t.debit,
			Credit: t.credit,
			Balance: t.balance,
			Type: t.type,
			Account: t.account,
			Year: t.year,
			Notes: t.notes
		}));
		const ws = XLSX.utils.json_to_sheet(data);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Filtered Transactions');
		XLSX.writeFile(wb, `tagledger-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
	}
</script>

{#if !$user}
	<div class="flex items-center justify-center min-h-screen">
		<p class="text-[var(--text-muted)]">Redirecting to login...</p>
	</div>
{:else}
	<div class="flex flex-col h-[calc(100dvh-44px)]">
		<div class="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
			<FileSelector />
			<div class="hidden sm:block flex-1"></div>
			<div class="flex items-center gap-2 ml-auto sm:ml-0">
				{#if $transactions.length > 0}
					<button
						onclick={exportFiltered}
						class="text-xs bg-[var(--bg-tertiary)] border border-[var(--border)] px-3 py-1 rounded hover:border-[var(--accent)] transition-colors"
					>Export ({$filteredTransactions.length})</button>
				{/if}
				<div class="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded p-0.5">
					<button
						class="text-xs px-3 py-1 rounded transition-colors"
						class:bg-[var(--accent)]={activeTab === 'table'}
						class:text-white={activeTab === 'table'}
						class:text-[var(--text-muted)]={activeTab !== 'table'}
						onclick={() => { activeTab = 'table'; }}
					>Transactions</button>
					<button
						class="text-xs px-3 py-1 rounded transition-colors"
						class:bg-[var(--accent)]={activeTab === 'pnl'}
						class:text-white={activeTab === 'pnl'}
						class:text-[var(--text-muted)]={activeTab !== 'pnl'}
						onclick={() => { activeTab = 'pnl'; }}
					>P&L</button>
				</div>
			</div>
		</div>

		{#if $transactions.length === 0}
			<div class="flex-1 flex items-center justify-center">
				<div class="text-center">
					<div class="text-4xl mb-4 opacity-20">&#128203;</div>
					<h2 class="text-lg font-medium mb-2">No data loaded</h2>
					<p class="text-sm text-[var(--text-muted)] mb-4">Load Excel files from Google Drive or upload from your computer</p>
				</div>
			</div>
		{:else}
			<FilterBar />
			<div class={activeTab === 'table' ? 'contents' : 'hidden'}>
				<TransactionTable />
				<TagSummary />
			</div>
			<div class={activeTab === 'pnl' ? 'flex-1 overflow-auto' : 'hidden'}>
				<PnLView />
			</div>
		{/if}
	</div>
{/if}
