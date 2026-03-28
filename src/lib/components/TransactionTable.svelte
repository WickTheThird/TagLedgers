<script lang="ts">
	import { filteredTransactions, availableTags, updateTransactionTag, addTransaction, deleteTransaction, fileSheetMap } from '$lib/stores/transactions';
	import { apiFetch } from '$lib/api';
	import type { Transaction } from '$lib/types';
	import { displayCurrency, getCurrencySymbol } from '$lib/stores/currency';
	import * as XLSX from 'xlsx';

	let sortCol = $state<keyof Transaction>('date');
	let sortDir = $state<'asc' | 'desc'>('desc');
	let editingTagId = $state<string | null>(null);
	let showAddForm = $state(false);
	let saving = $state(false);
	let saveError = $state('');
	let saveSuccess = $state('');

	// New entry form
	let newDate = $state(new Date().toISOString().slice(0, 10));
	let newDesc = $state('');
	let newDesc2 = $state('');
	let newDebit = $state('');
	let newCredit = $state('');
	let newTag = $state('UNTAGGED');
	let newAccount = $state('');
	let newNotes = $state('');
	let newFileName = $state('');
	let newSheet = $state('');

	// File/sheet options derived from loaded files
	let fileOptions = $derived(() => {
		const map = $fileSheetMap;
		return [...map.entries()].map(([name, info]) => ({
			name,
			driveId: info.driveId,
			sheets: info.sheets
		}));
	});

	let sheetOptions = $derived(() => {
		if (!newFileName) return [];
		const map = $fileSheetMap;
		const info = map.get(newFileName);
		return info ? info.sheets : [];
	});

	// Auto-select first sheet when file changes
	$effect(() => {
		const sheets = sheetOptions();
		if (sheets.length > 0 && !sheets.includes(newSheet)) {
			newSheet = sheets[0];
		}
	});

	// Auto-fill account from selected sheet
	$effect(() => {
		if (newSheet) {
			const match = newSheet.match(/^\d{4}\s+(.+)$/);
			if (match) newAccount = match[1].trim();
		}
	});

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

	async function handleAddEntry() {
		if (!newDesc || !newFileName || !newSheet) return;

		saving = true;
		saveError = '';
		saveSuccess = '';

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
			sourceSheet: newSheet,
			account: newAccount || 'MANUAL',
			year: date.getFullYear(),
			fileName: newFileName
		};

		try {
			// Get the Drive file ID
			const map = $fileSheetMap;
			const fileInfo = map.get(newFileName);
			if (!fileInfo) throw new Error('File not found in loaded files');

			// 1. Download the file from Drive
			const downloadRes = await apiFetch(`/api/drive/download/${fileInfo.driveId}`);
			if (!downloadRes.ok) throw new Error('Failed to download file');
			const buffer = await downloadRes.arrayBuffer();

			// 2. Parse with SheetJS
			const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
			const sheet = workbook.Sheets[newSheet];
			if (!sheet) throw new Error(`Sheet "${newSheet}" not found`);

			// 3. Find the header row and column mapping
			const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
			let headerMapping: Record<string, number> = {};
			let headerRow = -1;

			for (let r = 0; r < Math.min(5, rows.length); r++) {
				const row = rows[r];
				if (!row) continue;
				for (let c = 0; c < row.length; c++) {
					const cell = String(row[c] ?? '').trim().toLowerCase();
					if (cell.includes('date')) headerMapping['date'] = c;
					if (cell.includes('description') && !cell.includes('2')) headerMapping['description'] = c;
					if (cell.includes('description') && cell.includes('2')) headerMapping['description2'] = c;
					if (cell.includes('debit')) headerMapping['debit'] = c;
					if (cell.includes('credit')) headerMapping['credit'] = c;
					if (cell.includes('balance')) headerMapping['balance'] = c;
					if (cell.includes('type') || cell.includes('transaction')) headerMapping['type'] = c;
					if (cell.includes('tag') || cell.includes('column 1') || cell.includes('category') || cell.includes('classification')) headerMapping['tag'] = c;
					if (cell.includes('notes') || cell.includes('column 2')) headerMapping['notes'] = c;
				}
				if (Object.keys(headerMapping).length >= 3) {
					headerRow = r;
					break;
				}
				headerMapping = {};
			}

			if (headerRow < 0) throw new Error('Could not detect headers in sheet');

			// 4. Build the new row in the same column order
			const maxCol = Math.max(...Object.values(headerMapping), 0) + 1;
			const newRow: unknown[] = new Array(maxCol).fill('');

			if ('date' in headerMapping) newRow[headerMapping['date']] = date;
			if ('description' in headerMapping) newRow[headerMapping['description']] = newDesc;
			if ('description2' in headerMapping) newRow[headerMapping['description2']] = newDesc2;
			if ('debit' in headerMapping) newRow[headerMapping['debit']] = debit ?? '';
			if ('credit' in headerMapping) newRow[headerMapping['credit']] = credit ?? '';
			if ('type' in headerMapping) newRow[headerMapping['type']] = type;
			if ('tag' in headerMapping) newRow[headerMapping['tag']] = newTag;
			if ('notes' in headerMapping) newRow[headerMapping['notes']] = newNotes;

			// 5. Append the row to the sheet
			const ref = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
			const newRowNum = ref.e.r + 1;
			for (let c = 0; c < newRow.length; c++) {
				const val = newRow[c];
				if (val === '' || val == null) continue;
				const cellAddr = XLSX.utils.encode_cell({ r: newRowNum, c });
				if (val instanceof Date) {
					sheet[cellAddr] = { t: 'd', v: val };
				} else if (typeof val === 'number') {
					sheet[cellAddr] = { t: 'n', v: val };
				} else {
					sheet[cellAddr] = { t: 's', v: String(val) };
				}
			}
			// Update sheet range
			ref.e.r = newRowNum;
			sheet['!ref'] = XLSX.utils.encode_range(ref);

			// 6. Write back to buffer
			const updatedBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

			// 7. Upload to Drive (replace existing file)
			const formData = new FormData();
			const blob = new Blob([updatedBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
			formData.append('file', blob, newFileName);

			const updateRes = await apiFetch(`/api/drive/update/${fileInfo.driveId}`, {
				method: 'PUT',
				body: formData
			});

			if (!updateRes.ok) throw new Error('Failed to update file on Drive');

			// 8. Add to in-memory store
			addTransaction(tx);
			saveSuccess = 'Entry saved to Drive!';

			// Reset form
			newDate = new Date().toISOString().slice(0, 10);
			newDesc = '';
			newDesc2 = '';
			newDebit = '';
			newCredit = '';
			newTag = 'UNTAGGED';
			newNotes = '';

			setTimeout(() => { saveSuccess = ''; }, 3000);
		} catch (e: any) {
			saveError = e.message || 'Failed to save entry';
			// Still add to store so user sees it (marked as manual)
			addTransaction(tx);
			setTimeout(() => { saveError = ''; }, 5000);
		}

		saving = false;
	}

	function handleDelete(txId: string) {
		if (txId.startsWith('manual-')) {
			deleteTransaction(txId);
		}
	}

	const columns: { key: keyof Transaction; label: string; hideMobile?: boolean }[] = [
		{ key: 'date', label: 'Date' },
		{ key: 'description', label: 'Description' },
		{ key: 'tag', label: 'Tag' },
		{ key: 'debit', label: 'Debit' },
		{ key: 'credit', label: 'Credit' },
		{ key: 'balance', label: 'Balance', hideMobile: true },
		{ key: 'account', label: 'Account', hideMobile: true }
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
		{#if saveSuccess}
			<span class="text-xs text-[var(--green)]">{saveSuccess}</span>
		{/if}
		{#if saveError}
			<span class="text-xs text-[var(--red)]">{saveError}</span>
		{/if}
		<span class="text-xs text-[var(--text-muted)]">
			{sorted().length} rows
		</span>
	</div>

	<!-- Add Entry Form -->
	{#if showAddForm}
		<div class="flex flex-wrap gap-2 px-3 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--accent)]/30">
			<!-- Row 1: File + Sheet selection -->
			<div class="w-full flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mb-1">
				<label class="text-xs text-[var(--text-muted)] shrink-0">Save to:</label>
				<select bind:value={newFileName}
					class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 sm:py-1 text-xs text-[var(--text-primary)] flex-1 min-w-0 w-full sm:min-w-[180px]">
					<option value="">Select file...</option>
					{#each fileOptions() as file}
						<option value={file.name}>{file.name}</option>
					{/each}
				</select>
				<select bind:value={newSheet}
					class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 sm:py-1 text-xs text-[var(--text-primary)] flex-1 min-w-0 w-full sm:min-w-[160px]"
					disabled={!newFileName}>
					<option value="">Select sheet...</option>
					{#each sheetOptions() as sheet}
						<option value={sheet}>{sheet}</option>
					{/each}
				</select>
			</div>

			<!-- Row 2: Transaction fields -->
			<input type="date" bind:value={newDate}
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 sm:py-1 text-xs text-[var(--text-primary)] w-full sm:w-[130px]" />
			<input type="text" bind:value={newDesc} placeholder="Description *"
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 sm:py-1 text-xs text-[var(--text-primary)] flex-1 min-w-0 w-full sm:min-w-[150px]" />
			<input type="text" bind:value={newDesc2} placeholder="Description 2"
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 sm:py-1 text-xs text-[var(--text-primary)] w-full sm:w-[150px]" />
			<select bind:value={newTag}
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 sm:py-1 text-xs text-[var(--text-primary)] w-full sm:w-[140px]">
				<option value="UNTAGGED">UNTAGGED</option>
				{#each $availableTags as tag}
					<option value={tag}>{tag}</option>
				{/each}
			</select>
			<input type="number" bind:value={newDebit} placeholder="Debit" step="0.01"
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 sm:py-1 text-xs text-[var(--text-primary)] w-full sm:w-[100px]" />
			<input type="number" bind:value={newCredit} placeholder="Credit" step="0.01"
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 sm:py-1 text-xs text-[var(--text-primary)] w-full sm:w-[100px]" />
			<input type="text" bind:value={newAccount} placeholder="Account"
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 sm:py-1 text-xs text-[var(--text-primary)] w-full sm:w-[120px]" />
			<input type="text" bind:value={newNotes} placeholder="Notes"
				class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 sm:py-1 text-xs text-[var(--text-primary)] w-full sm:w-[120px]" />
			<button
				onclick={handleAddEntry}
				disabled={!newDesc || !newFileName || !newSheet || saving}
				class="bg-[var(--green)] text-black text-xs font-medium px-3 py-2 sm:py-1 rounded hover:opacity-90 transition-opacity disabled:opacity-30 w-full sm:w-auto"
			>{saving ? 'Saving...' : 'Add & Save'}</button>
		</div>
	{/if}

	<table class="w-full text-sm min-w-[700px]">
		<thead class="sticky top-0 bg-[var(--bg-secondary)] z-10">
			<tr>
				<th class="w-[30px] px-1"></th>
				{#each columns as col}
					<th
						class="text-left px-3 py-2 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)] border-b border-[var(--border)] select-none {col.hideMobile ? 'hidden sm:table-cell' : ''}"
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
								class="text-red-500/50 hover:text-red-500 text-xs sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
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
								class="bg-[var(--bg-tertiary)] border border-[var(--accent)] text-[var(--text-primary)] text-xs rounded px-1.5 py-1.5 sm:py-0.5 min-h-[36px] sm:min-h-0 outline-none"
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
								class="text-xs px-2 py-1.5 sm:py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--orange)] hover:bg-[var(--bg-hover)] transition-colors min-h-[36px] sm:min-h-0"
								onclick={() => { editingTagId = tx.id; }}
							>
								{tx.tag}
							</button>
						{/if}
					</td>
					<td class="px-3 py-1.5 text-right text-[var(--red)] font-mono">{formatAmount(tx.debit)}</td>
					<td class="px-3 py-1.5 text-right text-[var(--green)] font-mono">{formatAmount(tx.credit)}</td>
					<td class="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)] hidden sm:table-cell">{formatAmount(tx.balance)}</td>
					<td class="px-3 py-1.5 text-xs text-[var(--text-muted)] hidden sm:table-cell">{tx.account}</td>
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
