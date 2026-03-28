<script lang="ts">
	import { pnlData } from '$lib/stores/transactions';
	import { displayCurrency, formatWithCurrency } from '$lib/stores/currency';

	let expandedGroups = $state<Set<string>>(new Set());
	let expandedSections = $state<Set<string>>(new Set());

	function toggleGroup(name: string) {
		const next = new Set(expandedGroups);
		if (next.has(name)) next.delete(name); else next.add(name);
		expandedGroups = next;
	}

	function toggleSection(key: string) {
		const next = new Set(expandedSections);
		if (next.has(key)) next.delete(key); else next.add(key);
		expandedSections = next;
	}

	function expandAll() {
		expandedGroups = new Set($pnlData.map(g => g.name));
		const sections = new Set<string>();
		for (const g of $pnlData) {
			sections.add(`${g.name}-rev`);
			sections.add(`${g.name}-exp`);
		}
		expandedSections = sections;
	}

	function collapseAll() {
		expandedGroups = new Set();
		expandedSections = new Set();
	}

	function fmt(n: number) {
		return formatWithCurrency(n, $displayCurrency);
	}

	let consolidatedPnl = $derived(() => {
		let totalRev = 0, totalExp = 0;
		for (const g of $pnlData) {
			totalRev += g.totalRevenue;
			totalExp += g.totalExpenses;
		}
		return { totalRevenue: totalRev, totalExpenses: totalExp, netIncome: totalRev - totalExp };
	});
</script>

<div class="flex flex-col h-full overflow-hidden">
	<!-- Header -->
	<div class="px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 border-b border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
		<div class="flex items-center gap-3">
			<h2 class="text-sm font-semibold text-[var(--text-primary)]">Profit & Loss</h2>
			<button onclick={expandAll} class="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] min-h-[36px] sm:min-h-0">Expand all</button>
			<button onclick={collapseAll} class="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] min-h-[36px] sm:min-h-0">Collapse</button>
		</div>
		<div class="flex items-center gap-3 sm:gap-6 text-xs flex-wrap">
			<span class="text-[var(--green)]">Rev: {fmt(consolidatedPnl().totalRevenue)}</span>
			<span class="text-[var(--red)]">Exp: {fmt(consolidatedPnl().totalExpenses)}</span>
			<span class="font-bold text-sm sm:text-base" class:text-[var(--green)]={consolidatedPnl().netIncome >= 0} class:text-[var(--red)]={consolidatedPnl().netIncome < 0}>
				Net: {fmt(consolidatedPnl().netIncome)}
			</span>
		</div>
	</div>

	<!-- Scrollable content -->
	<div class="flex-1 overflow-auto">
		{#each $pnlData as group}
			<div class="border-b border-[var(--border)]/50">
				<!-- Group header -->
				<button
					class="w-full flex items-center justify-between px-3 sm:px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors min-h-[44px]"
					onclick={() => toggleGroup(group.name)}
				>
					<div class="flex items-center gap-2 shrink-0">
						<span class="text-xs text-[var(--text-muted)]">{expandedGroups.has(group.name) ? '\u25BC' : '\u25B6'}</span>
						<span class="font-semibold text-sm sm:text-base">{group.name}</span>
					</div>
					<div class="flex items-center gap-2 sm:gap-8 text-xs sm:text-sm font-mono">
						<span class="text-[var(--green)] min-w-[70px] sm:min-w-[100px] w-20 sm:w-32 text-right">{fmt(group.totalRevenue)}</span>
						<span class="text-[var(--red)] min-w-[70px] sm:min-w-[100px] w-20 sm:w-32 text-right">{fmt(group.totalExpenses)}</span>
						<span class="font-bold min-w-[70px] sm:min-w-[100px] w-20 sm:w-32 text-right" class:text-[var(--green)]={group.netIncome >= 0} class:text-[var(--red)]={group.netIncome < 0}>
							{fmt(group.netIncome)}
						</span>
					</div>
				</button>

				{#if expandedGroups.has(group.name)}
					<!-- Revenue section -->
					<div class="ml-3 sm:ml-6">
						<button
							class="w-full flex items-center justify-between px-3 sm:px-4 py-2 hover:bg-[var(--bg-hover)] min-h-[40px]"
							onclick={() => toggleSection(`${group.name}-rev`)}
						>
							<div class="flex items-center gap-2">
								<span class="text-xs text-[var(--text-muted)]">{expandedSections.has(`${group.name}-rev`) ? '\u25BC' : '\u25B6'}</span>
								<span class="text-[var(--green)] font-medium text-xs sm:text-sm">Revenue ({group.revenue.length} tags)</span>
							</div>
							<span class="text-[var(--green)] font-mono text-xs sm:text-sm min-w-[70px] sm:min-w-[100px] w-20 sm:w-32 text-right">{fmt(group.totalRevenue)}</span>
						</button>
						{#if expandedSections.has(`${group.name}-rev`)}
							{#each group.revenue as item}
								<div class="flex items-center justify-between px-4 sm:px-8 py-1.5 text-xs sm:text-sm hover:bg-[var(--bg-hover)] min-h-[36px]">
									<span class="text-[var(--text-secondary)] truncate mr-2">{item.tag}</span>
									<div class="flex items-center gap-2 sm:gap-8 shrink-0">
										<span class="text-[var(--text-muted)] text-xs w-10 sm:w-12 text-right">{item.count}x</span>
										<span class="font-mono text-[var(--green)] min-w-[70px] sm:min-w-[100px] w-20 sm:w-32 text-right">{fmt(item.amount)}</span>
									</div>
								</div>
							{/each}
						{/if}
					</div>

					<!-- Expenses section -->
					<div class="ml-3 sm:ml-6">
						<button
							class="w-full flex items-center justify-between px-3 sm:px-4 py-2 hover:bg-[var(--bg-hover)] min-h-[40px]"
							onclick={() => toggleSection(`${group.name}-exp`)}
						>
							<div class="flex items-center gap-2">
								<span class="text-xs text-[var(--text-muted)]">{expandedSections.has(`${group.name}-exp`) ? '\u25BC' : '\u25B6'}</span>
								<span class="text-[var(--red)] font-medium text-xs sm:text-sm">Expenses ({group.expenses.length} tags)</span>
							</div>
							<span class="text-[var(--red)] font-mono text-xs sm:text-sm min-w-[70px] sm:min-w-[100px] w-20 sm:w-32 text-right">{fmt(group.totalExpenses)}</span>
						</button>
						{#if expandedSections.has(`${group.name}-exp`)}
							{#each group.expenses as item}
								<div class="flex items-center justify-between px-4 sm:px-8 py-1.5 text-xs sm:text-sm hover:bg-[var(--bg-hover)] min-h-[36px]">
									<span class="text-[var(--text-secondary)] truncate mr-2">{item.tag}</span>
									<div class="flex items-center gap-2 sm:gap-8 shrink-0">
										<span class="text-[var(--text-muted)] text-xs w-10 sm:w-12 text-right">{item.count}x</span>
										<span class="font-mono text-[var(--red)] min-w-[70px] sm:min-w-[100px] w-20 sm:w-32 text-right">{fmt(item.amount)}</span>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
