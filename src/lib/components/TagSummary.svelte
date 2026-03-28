<script lang="ts">
	import { tagSummaries, totalStats } from '$lib/stores/transactions';
	import { displayCurrency, formatWithCurrency } from '$lib/stores/currency';

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
		return formatWithCurrency(n, $displayCurrency);
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

	function startTouchDrag(e: TouchEvent) {
		e.preventDefault();
		dragging = true;
		const startY = e.touches[0].clientY;
		const startH = panelHeight;

		function onTouchMove(ev: TouchEvent) {
			panelHeight = Math.max(100, Math.min(600, startH - (ev.touches[0].clientY - startY)));
		}
		function onTouchEnd() {
			dragging = false;
			window.removeEventListener('touchmove', onTouchMove);
			window.removeEventListener('touchend', onTouchEnd);
		}
		window.addEventListener('touchmove', onTouchMove, { passive: false });
		window.addEventListener('touchend', onTouchEnd);
	}
</script>

<div class="bg-[var(--bg-secondary)] border-t border-[var(--border)]">
	<!-- Drag handle -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="h-3 sm:h-1.5 cursor-row-resize flex items-center justify-center transition-colors {dragging ? 'bg-blue-500/30' : 'hover:bg-blue-500/20'}"
		onmousedown={startDrag}
		ontouchstart={startTouchDrag}
	>
		<div class="w-10 sm:w-8 h-1 sm:h-0.5 rounded bg-[var(--border)]"></div>
	</div>

	<div class="px-3 sm:px-4 py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 border-b border-[var(--border)]">
		<button onclick={() => { collapsed = !collapsed; }} class="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] min-h-[36px] sm:min-h-0">
			<span class="text-xs">{collapsed ? '\u25B6' : '\u25BC'}</span>
			Tag Summary
			<span class="text-xs font-normal text-[var(--text-muted)]">({sorted().length} tags)</span>
		</button>
		<div class="flex items-center gap-2 sm:gap-4 text-xs text-[var(--text-muted)] flex-wrap">
			<span class="hidden sm:inline">{sorted().length} tags</span>
			<span class="text-[var(--green)]">Cr: {fmt($totalStats.totalCredit)}</span>
			<span class="text-[var(--red)]">Dr: {fmt($totalStats.totalDebit)}</span>
			<span class="font-semibold" class:text-[var(--green)]={$totalStats.net >= 0} class:text-[var(--red)]={$totalStats.net < 0}>
				Net: {fmt($totalStats.net)}
			</span>
		</div>
	</div>

	{#if !collapsed}
		<div class="overflow-auto" style="max-height: {panelHeight}px">
			<table class="w-full text-sm min-w-[400px]">
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
