<script lang="ts">
	import { transactions, loadedFiles } from '$lib/stores/transactions';
	import { parseExcelBuffer } from '$lib/parser';
	import { apiFetch } from '$lib/api';

	interface DriveFileInfo {
		id: string;
		name: string;
		mimeType: string;
		modifiedTime: string;
		size: string;
		parents?: string[];
	}

	interface LoadedFileInfo {
		id: string;
		name: string;
		transactionCount: number;
		source: 'drive' | 'local';
	}

	let driveFiles = $state<DriveFileInfo[]>([]);
	let loaded = $state<LoadedFileInfo[]>([]);
	let selected = $state<Set<string>>(new Set());
	let loading = $state(false);
	let loadingFile = $state<string | null>(null);
	let uploading = $state(false);
	let error = $state('');
	let showPanel = $state(false);
	let loadingSelected = $state(false);

	async function fetchDriveFiles() {
		loading = true;
		error = '';
		try {
			const res = await apiFetch('/api/drive/files');
			if (!res.ok) throw new Error('Failed to fetch');
			const data = await res.json();
			driveFiles = data.files as DriveFileInfo[];
		} catch (e) {
			error = 'Failed to load Drive files.';
		}
		loading = false;
	}

	async function loadFile(file: DriveFileInfo) {
		if (loaded.some(l => l.id === file.id)) return;
		loadingFile = file.id;
		error = '';
		try {
			const res = await fetch(`/api/drive/download/${file.id}`);
			if (!res.ok) throw new Error('Download failed');
			const buffer = await res.arrayBuffer();
			const parsed = parseExcelBuffer(buffer, file.name);
			$transactions = [...$transactions, ...parsed];
			$loadedFiles = [...$loadedFiles, file.id];
			loaded = [...loaded, { id: file.id, name: file.name, transactionCount: parsed.length, source: 'drive' }];
		} catch (e) {
			error = `Failed to load ${file.name}`;
		}
		loadingFile = null;
	}

	async function loadAllFiles() {
		for (const file of driveFiles) {
			if (!loaded.some(l => l.id === file.id)) {
				await loadFile(file);
			}
		}
	}

	function toggleSelect(fileId: string) {
		const next = new Set(selected);
		if (next.has(fileId)) next.delete(fileId); else next.add(fileId);
		selected = next;
	}

	function selectAllUnloaded() {
		selected = new Set(driveFiles.filter(f => !isFileLoaded(f.id)).map(f => f.id));
	}

	function selectNone() {
		selected = new Set();
	}

	async function loadSelected() {
		loadingSelected = true;
		for (const fileId of selected) {
			const file = driveFiles.find(f => f.id === fileId);
			if (file && !isFileLoaded(file.id)) {
				await loadFile(file);
			}
		}
		selected = new Set();
		loadingSelected = false;
	}

	let selectedCount = $derived([...selected].filter(id => !isFileLoaded(id)).length);

	async function handleLocalUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files?.length) return;

		for (const file of input.files) {
			uploading = true;
			error = '';
			const buffer = await file.arrayBuffer();
			const parsed = parseExcelBuffer(buffer, file.name);
			$transactions = [...$transactions, ...parsed];

			// Upload to Drive (bank_xlsx_for_ledger folder)
			let driveFileId = file.name;
			let driveLink = '';
			try {
				const formData = new FormData();
				formData.append('file', file);
				// First folder ID = bank_xlsx_for_ledger
				const folderRes = await apiFetch('/api/drive/folders');
				let folderId = '';
				try {
					const folderData = await folderRes.json();
					folderId = folderData.bankFolder ?? '';
				} catch { /* fallback */ }

				if (folderId) {
					formData.append('folderId', folderId);
					const uploadRes = await apiFetch('/api/drive/upload', { method: 'POST', body: formData });
					if (uploadRes.ok) {
						const uploadData = await uploadRes.json();
						driveFileId = uploadData.id;
						driveLink = uploadData.webViewLink;
					}
				}
			} catch {
				// Upload to Drive failed, but local parse succeeded
			}

			// Track in DB Ledger
			try {
				await apiFetch('/api/ledger', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						fileName: file.name,
						driveFileId,
						driveLink,
						folder: 'bank_xlsx_for_ledger',
						sheetCount: new Set(parsed.map(t => t.sourceSheet)).size,
						transactionCount: parsed.length
					})
				});
			} catch { /* Ledger update failed silently */ }

			$loadedFiles = [...$loadedFiles, driveFileId];
			loaded = [...loaded, { id: driveFileId, name: file.name, transactionCount: parsed.length, source: 'local' }];
			uploading = false;
		}
		input.value = '';
		// Refresh drive files to show newly uploaded
		fetchDriveFiles();
	}

	function unloadFile(fileInfo: LoadedFileInfo) {
		$transactions = $transactions.filter(t => {
			if (fileInfo.source === 'drive') return t.fileName !== fileInfo.name;
			return t.fileName !== fileInfo.name;
		});
		$loadedFiles = $loadedFiles.filter(id => id !== fileInfo.id);
		loaded = loaded.filter(l => l.id !== fileInfo.id);
	}

	function clearAll() {
		$transactions = [];
		$loadedFiles = [];
		loaded = [];
	}

	function formatSize(bytes: string) {
		const n = parseInt(bytes);
		if (isNaN(n)) return '';
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / (1024 * 1024)).toFixed(1)} MB`;
	}

	function isFileLoaded(fileId: string) {
		return loaded.some(l => l.id === fileId);
	}
</script>

<div class="relative">
	<div class="flex items-center gap-2">
		<button
			onclick={() => { showPanel = !showPanel; if (showPanel && !driveFiles.length) fetchDriveFiles(); }}
			class="bg-[var(--accent)] text-white text-sm px-3 py-1.5 rounded hover:bg-[var(--accent-hover)] transition-colors"
		>
			{showPanel ? 'Close' : 'Files'}
		</button>

		<label class="bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm px-3 py-1.5 rounded hover:border-[var(--accent)] transition-colors cursor-pointer">
			{uploading ? 'Uploading...' : 'Upload & Sync'}
			<input type="file" accept=".xlsx,.xls" multiple onchange={handleLocalUpload} class="hidden" disabled={uploading} />
		</label>

		{#if loaded.length}
			<span class="text-xs text-[var(--text-muted)]">{loaded.length} file(s), {$transactions.length} tx</span>
			<button onclick={clearAll} class="text-xs text-[var(--red)] hover:underline">Clear all</button>
		{/if}
	</div>

	{#if showPanel}
		<div class="absolute top-full left-0 mt-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl z-50 w-[480px] max-h-[500px] flex flex-col">
			<!-- Loaded files section -->
			{#if loaded.length > 0}
				<div class="border-b border-[var(--border)]">
					<div class="px-3 py-2 flex items-center justify-between">
						<h3 class="text-xs font-semibold text-[var(--text-muted)] uppercase">Loaded ({loaded.length})</h3>
					</div>
					{#each loaded as fileInfo}
						<div class="flex items-center justify-between px-3 py-1.5 border-t border-[var(--border)]/30">
							<div class="flex-1 min-w-0">
								<p class="text-sm truncate text-[var(--green)]">{fileInfo.name}</p>
								<p class="text-xs text-[var(--text-muted)]">{fileInfo.transactionCount} transactions &middot; {fileInfo.source}</p>
							</div>
							<button onclick={() => unloadFile(fileInfo)} class="text-xs text-[var(--red)] hover:underline ml-2">Unload</button>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Drive files section -->
			<div class="flex-1 overflow-auto">
				<div class="px-3 py-2 flex items-center justify-between border-b border-[var(--border)]">
					<h3 class="text-xs font-semibold text-[var(--text-muted)] uppercase">Google Drive</h3>
					<div class="flex items-center gap-2">
						<button onclick={selectAllUnloaded} class="text-xs text-[var(--text-muted)] hover:underline">Select all</button>
						{#if selected.size > 0}
							<button onclick={selectNone} class="text-xs text-[var(--text-muted)] hover:underline">None</button>
						{/if}
						<button onclick={fetchDriveFiles} class="text-xs text-[var(--accent)] hover:underline">
							{loading ? 'Loading...' : 'Refresh'}
						</button>
					</div>
				</div>

				{#if error}
					<div class="p-3 text-sm text-[var(--red)]">{error}</div>
				{/if}

				{#each driveFiles as file}
					<div class="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] border-b border-[var(--border)]/30">
						{#if !isFileLoaded(file.id)}
							<input
								type="checkbox"
								checked={selected.has(file.id)}
								onchange={() => toggleSelect(file.id)}
								class="accent-[var(--accent)] shrink-0"
							/>
						{:else}
							<div class="w-[13px] shrink-0"></div>
						{/if}
						<button
							class="flex-1 flex items-center justify-between text-left min-w-0"
							onclick={() => { if (!isFileLoaded(file.id)) loadFile(file); }}
							disabled={isFileLoaded(file.id) || loadingFile === file.id}
						>
							<div class="flex-1 min-w-0">
								<p class="text-sm truncate" class:text-[var(--text-muted)]={isFileLoaded(file.id)}>
									{file.name}
								</p>
								<p class="text-xs text-[var(--text-muted)]">
									{formatSize(file.size)} &middot; {new Date(file.modifiedTime).toLocaleDateString()}
								</p>
							</div>
							{#if isFileLoaded(file.id)}
								<span class="text-xs text-[var(--green)]">Loaded</span>
							{:else if loadingFile === file.id}
								<span class="text-xs text-[var(--accent)]">Loading...</span>
							{:else}
								<span class="text-xs text-[var(--accent)]">Load</span>
							{/if}
						</button>
					</div>
				{/each}

				{#if !loading && driveFiles.length === 0}
					<div class="p-4 text-center text-sm text-[var(--text-muted)]">
						No Excel files found in Drive folders
					</div>
				{/if}
			</div>

			<!-- Load selected bar -->
			{#if selectedCount > 0}
				<div class="px-3 py-2 border-t border-[var(--border)] flex items-center justify-between bg-[var(--bg-tertiary)]">
					<span class="text-xs text-[var(--text-secondary)]">{selectedCount} file(s) selected</span>
					<button
						onclick={loadSelected}
						disabled={loadingSelected}
						class="bg-[var(--accent)] text-white text-xs px-3 py-1 rounded hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
					>
						{loadingSelected ? 'Loading...' : `Load ${selectedCount} file(s)`}
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
