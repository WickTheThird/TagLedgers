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

<!-- Mobile backdrop overlay -->
<div
	class="fixed inset-0 bg-black/40 z-40 sm:hidden"
	onclick={(e) => { e.stopPropagation(); onchange(selected); }}
></div>

<div
	class="fixed inset-x-0 bottom-0 z-50 rounded-t-lg sm:rounded-lg sm:absolute sm:bottom-auto sm:inset-x-auto sm:left-0 sm:top-full sm:mt-1 bg-[var(--bg-secondary)] border border-[var(--border)] shadow-xl min-w-[220px] max-h-[70dvh] sm:max-h-[320px] flex flex-col filter-popup-container"
	onclick={(e) => e.stopPropagation()}
>
	<!-- Drag handle for mobile -->
	<div class="flex justify-center pt-2 pb-1 sm:hidden">
		<div class="w-10 h-1 rounded-full bg-[var(--text-muted)]/30"></div>
	</div>
	<div class="p-2 border-b border-[var(--border)]">
		<input
			type="text"
			placeholder="Search..."
			bind:value={search}
			class="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded px-2 py-2 sm:py-1 outline-none focus:border-[var(--accent)]"
		/>
	</div>
	<div class="flex gap-3 sm:gap-2 px-2 pt-2 sm:pt-1.5 text-sm sm:text-xs">
		<button onclick={selectAll} class="text-[var(--accent)] hover:underline min-h-[40px] sm:min-h-0 flex items-center">All</button>
		<button onclick={selectNone} class="text-[var(--text-muted)] hover:underline min-h-[40px] sm:min-h-0 flex items-center">None</button>
	</div>
	<div class="overflow-y-auto flex-1 p-1.5">
		{#each filtered as opt}
			<label class="flex items-center gap-2 px-2 py-1 min-h-[40px] sm:min-h-0 rounded hover:bg-[var(--bg-hover)] cursor-pointer text-sm">
				<input
					type="checkbox"
					checked={selected.includes(opt)}
					onchange={() => toggle(opt)}
					class="accent-[var(--accent)] w-5 h-5 sm:w-auto sm:h-auto"
				/>
				<span class="text-[var(--text-primary)] truncate">{opt}</span>
			</label>
		{/each}
		{#if filtered.length === 0}
			<p class="text-sm text-[var(--text-muted)] px-2 py-1">No matches</p>
		{/if}
	</div>
</div>
