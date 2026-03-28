<script lang="ts">
	import { filteredTransactions, availableTags } from '$lib/stores/transactions';
	import type { Transaction } from '$lib/types';

	let sortCol = $state<keyof Transaction>('date');
	let sortDir = $state<'asc' | 'desc'>('desc');
	let editingTagId = $state<string | null>(null);

	let sorted = $derived(() => {
		const data = [...$filteredTransactions];
		data.sort((a, b) => {
			const av = a[sortCol];
			const bv = b[sortCol];
			let cmp = 0;
			if (av instanceof Date && bv instanceof Date) cmp = av.getTime() - bv.getTime();
			else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
			else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return data;
	});

	function toggleSort(col: keyof Transaction) {
		if (sortCol === col) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortCol = col;
			sortDir = 'desc';
		}
	}

	function formatDate(d: Date) {
		return d.toLocaleDateString('en-IE', { year: 'numeric', month: '2-digit', day: '2-digit' });
	}

	function formatAmount(n: number | null) {
		if (n == null) return '';
		return n.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function handleTagChange(txId: string, newTag: string) {
		// Update the transaction's tag in the store
		filteredTransactions.subscribe(() => {}); // noop, we modify via the main store
		// For now, tags are read-only from the parsed data
		// Future: persist tag changes back to Drive
		editingTagId = null;
	}

	const columns: { key: keyof Transaction; label: string; width: string }[] = [
		{ key: 'date', label: 'Date', width: '100px' },
		{ key: 'description', label: 'Description', width: '1fr' },
		{ key: 'tag', label: 'Tag', width: '160px' },
		{ key: 'debit', label: 'Debit', width: '110px' },
		{ key: 'credit', label: 'Credit', width: '110px' },
		{ key: 'balance', label: 'Balance', width: '110px' },
		{ key: 'account', label: 'Account', width: '150px' }
	];
</script>

<div class="overflow-auto flex-1">
	<table class="w-full text-sm">
		<thead class="sticky top-0 bg-[var(--bg-secondary)] z-10">
			<tr>
				{#each columns as col}
					<th
						class="text-left px-3 py-2 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)] border-b border-[var(--border)] select-none"
						onclick={() => toggleSort(col.key)}
					>
						{col.label}
						{#if sortCol === col.key}
							<span class="ml-1">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each sorted() as tx (tx.id)}
				<tr class="hover:bg-[var(--bg-hover)] border-b border-[var(--border)]/50 transition-colors">
					<td class="px-3 py-1.5 text-[var(--text-secondary)] whitespace-nowrap">{formatDate(tx.date)}</td>
					<td class="px-3 py-1.5 truncate max-w-[400px]" title={tx.description}>
						{tx.description}
						{#if tx.description2}
							<span class="text-[var(--text-muted)]"> | {tx.description2}</span>
						{/if}
					</td>
					<td class="px-3 py-1.5">
						{#if editingTagId === tx.id}
							<select
								class="bg-[var(--bg-tertiary)] border border-[var(--accent)] text-[var(--text-primary)] text-xs rounded px-1.5 py-0.5 outline-none"
								value={tx.tag}
								onchange={(e) => handleTagChange(tx.id, (e.target as HTMLSelectElement).value)}
								onblur={() => { editingTagId = null; }}
							>
								{#each $availableTags as tag}
									<option value={tag}>{tag}</option>
								{/each}
							</select>
						{:else}
							<button
								class="text-xs px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--orange)] hover:bg-[var(--bg-hover)] transition-colors"
								onclick={() => { editingTagId = tx.id; }}
							>
								{tx.tag}
							</button>
						{/if}
					</td>
					<td class="px-3 py-1.5 text-right text-[var(--red)] font-mono">{formatAmount(tx.debit)}</td>
					<td class="px-3 py-1.5 text-right text-[var(--green)] font-mono">{formatAmount(tx.credit)}</td>
					<td class="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{formatAmount(tx.balance)}</td>
					<td class="px-3 py-1.5 text-xs text-[var(--text-muted)]">{tx.account}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	{#if sorted().length === 0}
		<div class="flex items-center justify-center py-12 text-[var(--text-muted)]">
			No transactions match your filters
		</div>
	{/if}
</div>
