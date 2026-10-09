<script lang="ts">
	import type { Participant } from '$lib/types';
	import { generateId } from '$lib/utils';
	import { fileToAvatarDataUrl } from '$lib/avatar';

	interface Props {
		participants: Participant[];
		onUpdate: (participants: Participant[]) => void;
		darkMode?: boolean;
		deathMode?: boolean;
		onNotify?: (message: string) => void;
	}

	let { participants, onUpdate, darkMode = false, deathMode = false, onNotify }: Props = $props();

	let newName = $state('');
	let isExpanded = $state(true);
	let editingId = $state<string | null>(null);
	let editingName = $state('');

	const activeCount = $derived(participants.filter((p) => p.active).length);
	const totalCount = $derived(participants.length);

	function addParticipant() {
		const name = newName.trim();
		if (!name) return;

		const newParticipant: Participant = {
			id: generateId(),
			name,
			active: true
		};

		onUpdate([...participants, newParticipant]);
		newName = '';
	}

	function removeParticipant(id: string) {
		onUpdate(participants.filter((p) => p.id !== id));
	}

	function toggleActive(id: string) {
		onUpdate(
			participants.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
		);
	}

	function startEditing(participant: Participant) {
		editingId = participant.id;
		editingName = participant.name;
	}

	function saveEdit() {
		if (editingId && editingName.trim()) {
			onUpdate(
				participants.map((p) => (p.id === editingId ? { ...p, name: editingName.trim() } : p))
			);
		}
		editingId = null;
		editingName = '';
	}

	function cancelEdit() {
		editingId = null;
		editingName = '';
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			saveEdit();
		} else if (e.key === 'Escape') {
			cancelEdit();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			addParticipant();
		}
	}

	function updateColor(id: string, color: string) {
		onUpdate(
			participants.map((p) => (p.id === id ? { ...p, color } : p))
		);
	}

	// One hidden file input serves every row; imageTargetId says whose
	// picture the next chosen file belongs to
	let fileInput: HTMLInputElement;
	let imageTargetId: string | null = null;

	function pickImage(id: string) {
		imageTargetId = id;
		fileInput.click();
	}

	function updateImage(id: string, image: string | undefined) {
		onUpdate(
			participants.map((p) => (p.id === id ? { ...p, image } : p))
		);
	}

	async function handleFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		const id = imageTargetId;
		input.value = '';
		imageTargetId = null;
		if (!file || !id) return;
		try {
			updateImage(id, await fileToAvatarDataUrl(file));
		} catch (err) {
			onNotify?.(err instanceof Error ? err.message : 'Could not use that image');
		}
	}

	const LIGHT_COLORS = [
		'#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#DDA0DD',
		'#F7DC6F', '#BB8FCE', '#85C1E9', '#F8B739', '#2ECC71',
		'#E74C3C', '#3498DB'
	];

	const DARK_COLORS = [
		'#8B0000', '#4A0E4E', '#1a1a2e', '#6B0F1A', '#2D132C',
		'#4B0082', '#800020', '#3D0C02', '#1B1B3A', '#5C0A0A',
		'#2E0219', '#0D0D0D'
	];

	const presetColors = $derived(deathMode ? DARK_COLORS : LIGHT_COLORS);
</script>

<div class="w-full">
	<!-- Header with toggle -->
	<button
		onclick={() => (isExpanded = !isExpanded)}
		class="w-full flex items-center justify-between mb-3 text-left"
	>
		<span class="text-sm" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}>
			{activeCount} of {totalCount} remaining
		</span>
		<svg
			class="w-5 h-5 transition-transform"
			class:text-gray-400={!darkMode}
			class:text-gray-500={darkMode}
			class:rotate-180={isExpanded}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if isExpanded}
		<!-- Add name input -->
		<div class="flex gap-2 mb-3">
			<input
				type="text"
				bind:value={newName}
				onkeydown={handleKeydown}
				placeholder="Add a name..."
				class="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
				class:border-gray-300={!darkMode}
				class:bg-white={!darkMode}
				class:text-gray-900={!darkMode}
				class:border-slate-600={darkMode}
				class:bg-slate-700={darkMode}
				class:text-white={darkMode}
				class:placeholder-gray-400={!darkMode}
				class:placeholder-gray-500={darkMode}
			/>
			<button
				onclick={addParticipant}
				disabled={!newName.trim()}
				class="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
			>
				Add
			</button>
		</div>

		<!-- Participant list -->
		<ul class="space-y-1 max-h-48 overflow-y-auto pr-1">
			{#each participants as participant (participant.id)}
				<li
					class="flex items-center justify-between p-2 rounded-lg transition-colors text-sm"
					class:bg-gray-50={participant.active && !darkMode}
					class:bg-gray-100={!participant.active && !darkMode}
					class:bg-slate-700={participant.active && darkMode}
					class:bg-slate-600={!participant.active && darkMode}
					class:opacity-50={!participant.active}
				>
					<span class="flex items-center gap-2 min-w-0">
						<button
							onclick={() => toggleActive(participant.id)}
							class="w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors"
							class:border-indigo-500={participant.active}
							class:bg-indigo-500={participant.active}
							class:border-gray-300={!participant.active && !darkMode}
							class:border-gray-500={!participant.active && darkMode}
							title={participant.active ? 'Remove from wheel' : 'Add back to wheel'}
						>
							{#if participant.active}
								<svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
										clip-rule="evenodd"
									/>
								</svg>
							{/if}
						</button>
						{#if participant.image}
							<!-- The picture stands in for the colour swatch -->
							<span class="relative flex-shrink-0 group">
								<button
									onclick={() => pickImage(participant.id)}
									class="w-5 h-5 rounded overflow-hidden block"
									title="Change image"
								>
									<img src={participant.image} alt="" class="w-full h-full object-cover" />
								</button>
								<button
									onclick={() => updateImage(participant.id, undefined)}
									class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-gray-700 text-white text-[9px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity"
									title="Remove image"
								>&times;</button>
							</span>
						{:else}
							<input
								type="color"
								value={participant.color || presetColors[participants.indexOf(participant) % presetColors.length]}
								onchange={(e) => updateColor(participant.id, e.currentTarget.value)}
								class="w-5 h-5 rounded cursor-pointer border-0 p-0 flex-shrink-0"
								title="Change color"
							/>
							<button
								onclick={() => pickImage(participant.id)}
								class="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center transition-colors"
								class:bg-gray-200={!darkMode}
								class:hover:bg-gray-300={!darkMode}
								class:text-gray-500={!darkMode}
								class:bg-slate-600={darkMode}
								class:hover:bg-slate-500={darkMode}
								class:text-gray-300={darkMode}
								title="Add image"
							>
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25z"
									/>
								</svg>
							</button>
						{/if}
						{#if editingId === participant.id}
						<input
							type="text"
							bind:value={editingName}
							onkeydown={handleEditKeydown}
							onblur={saveEdit}
							class="flex-1 px-2 py-1 border rounded text-sm min-w-0 w-full"
							class:border-gray-300={!darkMode}
							class:bg-white={!darkMode}
							class:text-gray-900={!darkMode}
							class:border-slate-500={darkMode}
							class:bg-slate-600={darkMode}
							class:text-white={darkMode}
							autofocus
						/>
					{:else}
						<button
							onclick={() => startEditing(participant)}
							class="truncate text-left hover:opacity-70 cursor-pointer"
							class:line-through={!participant.active}
							class:text-gray-900={!darkMode}
							class:text-white={darkMode}
							title="Click to edit"
						>{participant.name}</button>
					{/if}
					</span>

					<button
						onclick={() => removeParticipant(participant.id)}
						class="text-red-400 hover:text-red-600 p-1 flex-shrink-0"
						title="Delete"
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</li>
			{/each}
		</ul>

		{#if participants.length === 0}
			<p class="text-center py-3 text-sm" class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>No participants yet</p>
		{/if}
	{/if}

	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		class="hidden"
		onchange={handleFileChange}
	/>
</div>
