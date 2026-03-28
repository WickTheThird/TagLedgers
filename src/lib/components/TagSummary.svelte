<script lang="ts">
	import { tagSummaries, totalStats } from '$lib/stores/transactions';

	let sortCol = $state<'tag' | 'totalDebit' | 'totalCredit' | 'net' | 'count'>('net');
	let sortDir = $state<'asc' | 'desc'>('desc');
	let panelHeight = $state(300);
	let dragging = $state(false);
	let collapsed = $state(false);

	let sorted = $derived(() => {
		const data = [...$tagSummaries];
		data.sort((a, b) => {
			const av = a[sortCol];
			const bv = b[sortCol];
			let cmp = typeof av === 'number' ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return data;
	});

	function toggleSort(col: typeof sortCol) {
		if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else { sortCol = col; sortDir = 'desc'; }
	}

	function fmt(n: number) {
		return n.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function startDrag(e: MouseEvent) {
		e.preventDefault();
		dragging = true;
		const startY = e.clientY;
		const startH = panelHeight;

		function onMove(ev: MouseEvent) {
			panelHeight = Math.max(100, Math.min(600, startH - (ev.clientY - startY)));
		}
		function onUp() {
			dragging = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		}
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}
</script>

<div class="bg-[var(--bg-secondary)] border-t border-[var(--border)]">
	<!-- Drag handle -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="h-1.5 cursor-row-resize flex items-center justify-center transition-colors {dragging ? 'bg-blue-500/30' : 'hover:bg-blue-500/20'}"
		onmousedown={startDrag}
	>
		<div class="w-8 h-0.5 rounded bg-[var(--border)]"></div>
	</div>

	<div class="px-4 py-1.5 flex items-center justify-between border-b border-[var(--border)]">
		<button onclick={() => { collapsed = !collapsed; }} class="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
			<span class="text-xs">{collapsed ? '\u25B6' : '\u25BC'}</span>
			Tag Summary
		</button>
		<div class="flex items-center gap-4 text-xs text-[var(--text-muted)]">
			<span>{sorted().length} tags</span>
			<span class="text-[var(--green)]">Credit: {fmt($totalStats.totalCredit)}</span>
			<span class="text-[var(--red)]">Debit: {fmt($totalStats.totalDebit)}</span>
			<span class="font-semibold" class:text-[var(--green)]={$totalStats.net >= 0} class:text-[var(--red)]={$totalStats.net < 0}>
				Net: {fmt($totalStats.net)}
			</span>
		</div>
	</div>

	{#if !collapsed}
		<div class="overflow-auto" style="max-height: {panelHeight}px">
			<table class="w-full text-sm">
				<thead class="sticky top-0 bg-[var(--bg-secondary)]">
					<tr>
						{#each [
							{ key: 'tag', label: 'Tag' },
							{ key: 'count', label: '#' },
							{ key: 'totalDebit', label: 'Total Debit' },
							{ key: 'totalCredit', label: 'Total Credit' },
							{ key: 'net', label: 'Net' }
						] as col}
							<th
								class="text-left px-3 py-2 text-xs font-medium text-[var(--text-muted)] uppercase cursor-pointer hover:text-[var(--text-primary)] border-b border-[var(--border)] select-none"
								class:text-right={col.key !== 'tag'}
								onclick={() => toggleSort(col.key as typeof sortCol)}
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
					{#each sorted() as s}
						<tr class="hover:bg-[var(--bg-hover)] border-b border-[var(--border)]/30">
							<td class="px-3 py-1.5">
								<span class="text-xs px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--orange)]">{s.tag}</span>
							</td>
							<td class="px-3 py-1.5 text-right text-[var(--text-muted)]">{s.count}</td>
							<td class="px-3 py-1.5 text-right font-mono text-[var(--red)]">{fmt(s.totalDebit)}</td>
							<td class="px-3 py-1.5 text-right font-mono text-[var(--green)]">{fmt(s.totalCredit)}</td>
							<td class="px-3 py-1.5 text-right font-mono" class:text-[var(--green)]={s.net >= 0} class:text-[var(--red)]={s.net < 0}>
								{fmt(s.net)}
							</td>
						</tr>
					{/each}
				</tbody>
				<tfoot class="bg-[var(--bg-tertiary)]">
					<tr class="font-semibold">
						<td class="px-3 py-2">TOTAL</td>
						<td class="px-3 py-2 text-right">{$totalStats.count}</td>
						<td class="px-3 py-2 text-right font-mono text-[var(--red)]">{fmt($totalStats.totalDebit)}</td>
						<td class="px-3 py-2 text-right font-mono text-[var(--green)]">{fmt($totalStats.totalCredit)}</td>
						<td class="px-3 py-2 text-right font-mono" class:text-[var(--green)]={$totalStats.net >= 0} class:text-[var(--red)]={$totalStats.net < 0}>
							{fmt($totalStats.net)}
						</td>
					</tr>
				</tfoot>
			</table>
		</div>
	{/if}
</div>
