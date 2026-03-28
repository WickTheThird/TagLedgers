<script lang="ts">
	let { options, selected, onchange }: {
		options: string[];
		selected: string[];
		onchange: (val: string[]) => void;
	} = $props();

	let search = $state('');
	let filtered = $derived(
		search
			? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
			: options
	);

	function toggle(opt: string) {
		if (selected.includes(opt)) {
			onchange(selected.filter(s => s !== opt));
		} else {
			onchange([...selected, opt]);
		}
	}

	function selectAll() {
		onchange([...options]);
	}

	function selectNone() {
		onchange([]);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="absolute top-full left-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl z-50 min-w-[220px] max-h-[320px] flex flex-col filter-popup-container"
	onclick={(e) => e.stopPropagation()}
>
	<div class="p-2 border-b border-[var(--border)]">
		<input
			type="text"
			placeholder="Search..."
			bind:value={search}
			class="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded px-2 py-1 outline-none focus:border-[var(--accent)]"
		/>
	</div>
	<div class="flex gap-2 px-2 pt-1.5 text-xs">
		<button onclick={selectAll} class="text-[var(--accent)] hover:underline">All</button>
		<button onclick={selectNone} class="text-[var(--text-muted)] hover:underline">None</button>
	</div>
	<div class="overflow-y-auto flex-1 p-1.5">
		{#each filtered as opt}
			<label class="flex items-center gap-2 px-2 py-1 rounded hover:bg-[var(--bg-hover)] cursor-pointer text-sm">
				<input
					type="checkbox"
					checked={selected.includes(opt)}
					onchange={() => toggle(opt)}
					class="accent-[var(--accent)]"
				/>
				<span class="text-[var(--text-primary)] truncate">{opt}</span>
			</label>
		{/each}
		{#if filtered.length === 0}
			<p class="text-sm text-[var(--text-muted)] px-2 py-1">No matches</p>
		{/if}
	</div>
</div>
