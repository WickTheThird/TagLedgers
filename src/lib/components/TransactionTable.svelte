<script lang="ts">
	import { filteredTransactions, availableTags, updateTransactionTag, addTransaction, deleteTransaction } from '$lib/stores/transactions';
	import type { Transaction } from '$lib/types';

	let sortCol = $state<keyof Transaction>('date');
	let sortDir = $state<'asc' | 'desc'>('desc');
	let editingTagId = $state<string | null>(null);
	let showAddForm = $state(false);

	// New entry form
	let newDate = $state(new Date().toISOString().slice(0, 10));
	let newDesc = $state('');
	let newDesc2 = $state('');
	let newDebit = $state('');
	let newCredit = $state('');
	let newTag = $state('UNTAGGED');
	let newAccount = $state('');
	let newNotes = $state('');

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
		updateTransactionTag(txId, newTag);
		editingTagId = null;
	}

	function handleAddEntry() {
		const date = new Date(newDate);
		const debit = newDebit ? parseFloat(newDebit) : null;
		const credit = newCredit ? parseFloat(newCredit) : null;
		const type: 'Credit' | 'Debit' = credit && credit > 0 ? 'Credit' : 'Debit';

		const tx: Transaction = {
			id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			date,
			description: newDesc,
			description2: newDesc2,
			debit,
			credit,
			balance: null,
			currency: 'EUR',
			type,
			tag: newTag,
			notes: newNotes,
			sourceSheet: 'Manual Entry',
			account: newAccount || 'MANUAL',
			year: date.getFullYear(),
			fileName: 'manual'
		};

		addTransaction(tx);
		// Reset form
		newDate = new Date().toISOString().slice(0, 10);
		newDesc = '';
		newDesc2 = '';
		newDebit = '';
		newCredit = '';
		newTag = 'UNTAGGED';
		newAccount = '';
		newNotes = '';
		showAddForm = false;
	}

	function handleDelete(txId: string) {
		if (txId.startsWith('manual-')) {
			deleteTransaction(txId);
		}
	}

	const columns: { key: keyof Transaction; label: string }[] = [
		{ key: 'date', label: 'Date' },
		{ key: 'description', label: 'Description' },
		{ key: 'tag', label: 'Tag' },
		{ key: 'debit', label: 'Debit' },
		{ key: 'credit', label: 'Credit' },
		{ key: 'balance', label: 'Balance' },
		{ key: 'account', label: 'Account' }
	];
</script>

<div class="overflow-auto flex-1">
	<!-- Add Entry Button -->
	<div class="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
		<button
			class="text-xs px-3 py-1 rounded transition-colors {showAddForm ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/30'}"
			onclick={() => { showAddForm = !showAddForm; }}
		>
			{showAddForm ? 'Cancel' : '+ Add Entry'}
		</button>
		<span class="text-xs text-[var(--text-muted)]">
			{sorted().length} rows
		</span>
	</div>

	<!-- Add Entry Form -->
	{#if showAddForm}
		<div class="flex flex-wrap gap-2 px-3 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--accent)]/30">
			<input type="date" bind:value={newDate}
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] w-[130px]" />
			<input type="text" bind:value={newDesc} placeholder="Description"
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] flex-1 min-w-[150px]" />
			<input type="text" bind:value={newDesc2} placeholder="Description 2"
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] w-[150px]" />
			<select bind:value={newTag}
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] w-[140px]">
				<option value="UNTAGGED">UNTAGGED</option>
				{#each $availableTags as tag}
					<option value={tag}>{tag}</option>
				{/each}
			</select>
			<input type="number" bind:value={newDebit} placeholder="Debit" step="0.01"
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] w-[100px]" />
			<input type="number" bind:value={newCredit} placeholder="Credit" step="0.01"
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] w-[100px]" />
			<input type="text" bind:value={newAccount} placeholder="Account"
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] w-[120px]" />
			<input type="text" bind:value={newNotes} placeholder="Notes"
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] w-[120px]" />
			<button
				onclick={handleAddEntry}
				disabled={!newDesc}
				class="bg-[var(--green)] text-black text-xs font-medium px-3 py-1 rounded hover:opacity-90 transition-opacity disabled:opacity-30"
			>Add</button>
		</div>
	{/if}

	<table class="w-full text-sm">
		<thead class="sticky top-0 bg-[var(--bg-secondary)] z-10">
			<tr>
				<th class="w-[30px] px-1"></th>
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
				<tr class="hover:bg-[var(--bg-hover)] border-b border-[var(--border)]/50 transition-colors group">
					<td class="px-1 py-1.5 text-center">
						{#if tx.id.startsWith('manual-')}
							<button
								class="text-red-500/50 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
								onclick={() => handleDelete(tx.id)}
								title="Delete manual entry"
							>&times;</button>
						{/if}
					</td>
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
