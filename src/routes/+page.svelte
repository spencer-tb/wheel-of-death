<script lang="ts">
	import { onMount } from 'svelte';
	import confetti from 'canvas-confetti';
	import Wheel from '$lib/components/Wheel.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import ParticipantList from '$lib/components/ParticipantList.svelte';
	import type { Participant } from '$lib/types';
	import { generateId, getRandomPhrase, secureRandom } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const NORMAL_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
	const DEATH_NAMES = ['Dracula', 'Zombie', 'Skeleton', 'Ghost', 'Vampire', 'Banshee'];

	const DEATH_TAGLINES = [
		'Spin the wheel... if you dare',
		'Who will meet their fate?',
		'The dead shall decide',
		'Fortune favors the doomed',
		'No one escapes the wheel',
		'Your destiny awaits',
		'The spirits grow restless',
		'Death spins for no one',
		'Enter the realm of the damned',
		'The underworld beckons'
	];

	const FUN_TAGLINES = [
		'Spin to pick the next person!',
		'Who will be the lucky one?',
		'Let fate decide!',
		'Round and round it goes...',
		'The wheel knows all!',
		'Give it a spin!',
		'Your turn awaits!',
		'Spin to find out!',
		'Let the wheel decide!',
		'Ready, set, spin!'
	];

	function getTagline(isDark: boolean): string {
		const list = isDark ? DEATH_TAGLINES : FUN_TAGLINES;
		return list[Math.floor(secureRandom() * list.length)];
	}

	function createParticipants(names: string[]): Participant[] {
		return names.map((name) => ({
			id: generateId(),
			name,
			active: true
		}));
	}

	// Load from config or use defaults
	const hasConfig = !!data.config;
	let wheelId = $state<string | null>(data.config?.id || null);
	let participants = $state<Participant[]>(data.config?.participants || createParticipants(NORMAL_NAMES));
	let namesEdited = $state(hasConfig);
	let timerDuration = $state(data.config?.timerDuration || 120);
	let timerEnabled = $state(data.config?.timerEnabled ?? true);
	let isTimerRunning = $state(false);
	let wheelSize = $state(750);
	let darkMode = $state(data.config?.darkMode ?? false);
	let fastMode = $state(data.config?.fastMode ?? false);
	let soundEnabled = $state(data.config?.soundEnabled ?? true);
	let idleSpinEnabled = $state(data.config?.idleSpinEnabled ?? true);
	let colorScheme = $state<'default' | 'rainbow' | 'pastel' | 'ocean' | 'sunset'>(data.config?.colorScheme || 'default');
	let currentTagline = $state(getTagline(data.config?.darkMode ?? false));
	let showToast = $state(false);
	let toastMessage = $state('');

	const MOBILE_BREAKPOINT = 900;

	async function fetchGlobalSpinCount() {
		try {
			const res = await fetch('/api/spins');
			const data = await res.json();
			globalSpinCount = data.count || 0;
		} catch (e) {
			console.error('Failed to fetch spin count:', e);
		}
	}

	async function incrementGlobalSpinCount() {
		try {
			const res = await fetch('/api/spins', { method: 'POST' });
			const data = await res.json();
			globalSpinCount = data.count || globalSpinCount + 1;
		} catch (e) {
			console.error('Failed to increment spin count:', e);
			globalSpinCount++; // Optimistic update
		}
	}

	onMount(() => {
		function updateSize() {
			const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
			wheelSize = isMobile ? Math.min(window.innerWidth - 40, 500) : 750;
		}
		updateSize();
		window.addEventListener('resize', updateSize);

		// Fetch global spin count
		fetchGlobalSpinCount();

		return () => window.removeEventListener('resize', updateSize);
	});

	function toast(message: string) {
		toastMessage = message;
		showToast = true;
		setTimeout(() => {
			showToast = false;
		}, 2000);
	}
	let selectedParticipant = $state<Participant | null>(null);
	let showResult = $state(false);
	let pendingRemoval = $state<string | null>(null);
	let winnerPhrase = $state('');
	let showPanel = $state(true);
	let spinCount = $state(0);
	let globalSpinCount = $state(0);

	const activeCount = $derived(participants.filter((p) => p.active).length);

	let isSaving = $state(false);

	async function saveWheel() {
		if (participants.length === 0) return;

		isSaving = true;
		try {
			const res = await fetch('/api/wheel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: wheelId,
					participants,
					timerDuration,
					timerEnabled,
					darkMode,
					fastMode,
					soundEnabled,
					idleSpinEnabled,
					colorScheme,
					createdAt: data.config?.createdAt
				})
			});
			const result = await res.json();
			if (result.id && !wheelId) {
				wheelId = result.id;
				// Update URL without reload
				window.history.replaceState({}, '', `/?id=${result.id}`);
			}
			toast('Saved!');
		} catch (e) {
			console.error('Failed to save wheel:', e);
		}
		isSaving = false;
	}

	function handleSpinStart() {
		spinCount++;
		incrementGlobalSpinCount();
		if (pendingRemoval) {
			participants = participants.map((p) =>
				p.id === pendingRemoval ? { ...p, active: false } : p
			);
			pendingRemoval = null;
			namesEdited = true;
		}
		isTimerRunning = false;
		showResult = false;
		selectedParticipant = null;
	}

	function fireConfetti() {
		// No confetti in death mode
		if (darkMode) return;

		const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F', '#BB8FCE', '#96E6A1'];

		// 3x3 grid covering the viewport with gaps between cells
		const cellWidth = 0.25;
		const cellHeight = 0.25;
		const cells = [
			// Row 1 (top)
			{ x: 0.05, y: 0.05 },
			{ x: 0.375, y: 0.05 },
			{ x: 0.7, y: 0.05 },
			// Row 2 (middle)
			{ x: 0.05, y: 0.375 },
			{ x: 0.375, y: 0.375 },
			{ x: 0.7, y: 0.375 },
			// Row 3 (bottom)
			{ x: 0.05, y: 0.7 },
			{ x: 0.375, y: 0.7 },
			{ x: 0.7, y: 0.7 }
		];

		// Fire confetti randomly over 3 seconds, picking random cells
		const totalDuration = 3000;
		const burstCount = 12;

		for (let i = 0; i < burstCount; i++) {
			const delay = secureRandom() * totalDuration;
			const cell = cells[Math.floor(secureRandom() * cells.length)];

			setTimeout(() => {
				confetti({
					particleCount: 50 + secureRandom() * 50,
					spread: 60 + secureRandom() * 40,
					origin: {
						x: cell.x + secureRandom() * cellWidth,
						y: cell.y + secureRandom() * cellHeight
					},
					colors,
					startVelocity: 30 + secureRandom() * 20,
					zIndex: 40
				});
			}, delay);
		}
	}

	function handleSpinComplete(participant: Participant) {
		selectedParticipant = participant;
		winnerPhrase = getRandomPhrase(darkMode);

		// Same behavior for both modes, just different spin speed
		showResult = true;
		if (timerEnabled) {
			isTimerRunning = true;
		}
		pendingRemoval = participant.id;

		// Fire effects!
		if (darkMode) {
			fireBloodSplats();
		} else {
			fireConfetti();
		}
	}

	function fireBloodSplats() {
		// 3x3 grid for blood splat positions
		const cells = [
			{ x: 5, y: 5 }, { x: 37.5, y: 5 }, { x: 70, y: 5 },
			{ x: 5, y: 37.5 }, { x: 37.5, y: 37.5 }, { x: 70, y: 37.5 },
			{ x: 5, y: 70 }, { x: 37.5, y: 70 }, { x: 70, y: 70 }
		];
		const cellSize = 25;

		const splatCount = 40;
		const totalDuration = 3000;

		for (let i = 0; i < splatCount; i++) {
			const delay = secureRandom() * totalDuration;
			const cell = cells[Math.floor(secureRandom() * cells.length)];

			setTimeout(() => {
				const splat = document.createElement('div');
				splat.className = 'blood-splat';
				splat.style.left = `${cell.x + secureRandom() * cellSize}%`;
				splat.style.top = `${cell.y + secureRandom() * cellSize}%`;
				splat.style.setProperty('--scale', String(0.5 + secureRandom() * 1));
				splat.style.setProperty('--rotation', `${secureRandom() * 360}deg`);
				document.body.appendChild(splat);

				// Remove after animation
				setTimeout(() => splat.remove(), 2000);
			}, delay);
		}
	}

	function handleTimerComplete() {
		isTimerRunning = false;
	}

	function handleParticipantsUpdate(updated: Participant[]) {
		participants = updated;
		namesEdited = true;
	}

	function toggleDeathMode() {
		darkMode = !darkMode;
		currentTagline = getTagline(darkMode);

		// Clear custom colors when switching modes
		participants = participants.map(p => ({ ...p, color: undefined }));

		// Only swap names if user hasn't edited them
		if (!namesEdited) {
			participants = createParticipants(darkMode ? DEATH_NAMES : NORMAL_NAMES);
		}
	}

	function resetAll() {
		participants = participants.map((p) => ({ ...p, active: true }));
		isTimerRunning = false;
		showResult = false;
		selectedParticipant = null;
	}

	function clearAll() {
		participants = [];
		isTimerRunning = false;
		showResult = false;
		selectedParticipant = null;
		pendingRemoval = null;
		namesEdited = true;
	}

	function clearEffects() {
		// Clear confetti
		confetti.reset();
		// Remove blood splats
		document.querySelectorAll('.blood-splat').forEach(el => el.remove());
	}

	function closePopup() {
		showResult = false;
		isTimerRunning = false;
		pendingRemoval = null; // Don't remove the name, just close
		clearEffects();
	}

	function removeFromWheel() {
		if (selectedParticipant) {
			participants = participants.map((p) =>
				p.id === selectedParticipant!.id ? { ...p, active: false } : p
			);
			pendingRemoval = null;
			namesEdited = true;
		}
		showResult = false;
		isTimerRunning = false;
		clearEffects();
	}

	function copyLink() {
		if (!wheelId) return;
		const url = `${window.location.origin}/?id=${wheelId}`;
		navigator.clipboard.writeText(url);
		toast('Link copied!');
	}
</script>

<svelte:head>
	<title>{darkMode ? '🪦 Wheel of Death' : '🎉 Wheel of Fun'}</title>
</svelte:head>

{#snippet settingsContent()}
	<!-- Participants Section -->
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-xl font-semibold" class:text-gray-800={!darkMode} class:text-white={darkMode}>Participants</h2>
		<div class="flex items-center gap-2">
			<button
				onclick={() => showPanel = false}
				class="hidden min-[900px]:block text-xs px-2 py-1 rounded transition-colors"
				class:text-gray-500={!darkMode}
				class:hover:text-gray-700={!darkMode}
				class:hover:bg-gray-100={!darkMode}
				class:text-gray-400={darkMode}
				class:hover:text-gray-300={darkMode}
				class:hover:bg-slate-700={darkMode}
				title="Hide settings"
			>
				Hide
			</button>
			{#if participants.length > 0}
				<button
					onclick={clearAll}
					class="text-xs px-2 py-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950 transition-colors"
					title="Clear all participants"
				>
					Clear All
				</button>
			{/if}
			<span class="text-xs px-2 py-1 rounded-full" class:text-gray-500={!darkMode} class:bg-gray-100={!darkMode} class:text-gray-400={darkMode} class:bg-slate-700={darkMode}>
				{activeCount}/{participants.length}
			</span>
		</div>
	</div>

	<ParticipantList
		{participants}
		{darkMode}
		onUpdate={handleParticipantsUpdate}
	/>

	<!-- Settings Section -->
	<div class="mt-5 pt-5 border-t" class:border-gray-200={!darkMode} class:border-slate-700={darkMode}>
		<h3 class="text-lg font-semibold mb-4" class:text-gray-700={!darkMode} class:text-gray-300={darkMode}>Settings</h3>

		<!-- Death Mode Toggle -->
		<div class="flex items-center justify-between mb-3">
			<span class="text-sm" class:text-gray-600={!darkMode} class:text-gray-400={darkMode}>Death Mode</span>
			<button
				onclick={toggleDeathMode}
				class="relative w-11 h-6 rounded-full transition-colors"
				class:bg-red-600={darkMode}
				class:bg-gray-300={!darkMode}
			>
				<span
					class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
					class:translate-x-5={darkMode}
				></span>
			</button>
		</div>

		<!-- Fast Mode Toggle -->
		<div class="flex items-center justify-between mb-3">
			<span class="text-sm" class:text-gray-600={!darkMode} class:text-gray-400={darkMode}>Fast Spin</span>
			<button
				onclick={() => { fastMode = !fastMode; }}
				class="relative w-11 h-6 rounded-full transition-colors"
				class:bg-indigo-600={fastMode}
				class:bg-gray-300={!fastMode}
			>
				<span
					class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
					class:translate-x-5={fastMode}
				></span>
			</button>
		</div>

		<!-- Sound Toggle -->
		<div class="flex items-center justify-between mb-3">
			<span class="text-sm" class:text-gray-600={!darkMode} class:text-gray-400={darkMode}>Sound</span>
			<button
				onclick={() => { soundEnabled = !soundEnabled; }}
				class="relative w-11 h-6 rounded-full transition-colors"
				class:bg-indigo-600={soundEnabled}
				class:bg-gray-300={!soundEnabled}
			>
				<span
					class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
					class:translate-x-5={soundEnabled}
				></span>
			</button>
		</div>

		<!-- Idle Spin Toggle -->
		<div class="flex items-center justify-between mb-3">
			<span class="text-sm" class:text-gray-600={!darkMode} class:text-gray-400={darkMode}>Background Spin</span>
			<button
				onclick={() => { idleSpinEnabled = !idleSpinEnabled; }}
				class="relative w-11 h-6 rounded-full transition-colors"
				class:bg-indigo-600={idleSpinEnabled}
				class:bg-gray-300={!idleSpinEnabled}
			>
				<span
					class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
					class:translate-x-5={idleSpinEnabled}
				></span>
			</button>
		</div>

		<!-- Timer Toggle -->
		<div class="flex items-center justify-between mb-3">
			<span class="text-sm" class:text-gray-600={!darkMode} class:text-gray-400={darkMode}>Timer</span>
			<button
				onclick={() => { timerEnabled = !timerEnabled; }}
				class="relative w-11 h-6 rounded-full transition-colors"
				class:bg-indigo-600={timerEnabled}
				class:bg-gray-300={!timerEnabled}
			>
				<span
					class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
					class:translate-x-5={timerEnabled}
				></span>
			</button>
		</div>

		<!-- Timer Duration -->
		{#if timerEnabled}
			<div class="mb-3">
				<label class="text-sm block mb-1" class:text-gray-600={!darkMode} class:text-gray-400={darkMode}>Duration (seconds)</label>
				<input
					type="number"
					bind:value={timerDuration}
					min="10"
					max="600"
					class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
					class:border-gray-300={!darkMode}
					class:bg-white={!darkMode}
					class:border-slate-600={darkMode}
					class:bg-slate-700={darkMode}
					class:text-white={darkMode}
				/>
			</div>
		{/if}

	</div>

	<!-- Actions -->
	<div class="mt-3 pt-3 border-t space-y-2" class:border-gray-100={!darkMode} class:border-slate-700={darkMode}>
		{#if participants.some((p) => !p.active)}
			<button
				onclick={resetAll}
				class="w-full px-3 py-2 text-sm rounded-lg transition-colors"
				class:bg-gray-100={!darkMode}
				class:text-gray-700={!darkMode}
				class:hover:bg-gray-200={!darkMode}
				class:bg-slate-700={darkMode}
				class:text-gray-300={darkMode}
				class:hover:bg-slate-600={darkMode}
			>
				Reset All
			</button>
		{/if}

		{#if participants.length > 0}
			<button
				onclick={clearAll}
				class="w-full px-3 py-2 text-sm rounded-lg transition-colors"
				class:bg-red-100={!darkMode}
				class:text-red-700={!darkMode}
				class:hover:bg-red-200={!darkMode}
				class:bg-red-950={darkMode}
				class:text-red-400={darkMode}
				class:hover:bg-red-900={darkMode}
			>
				Clear All
			</button>
		{/if}

		<div class="flex gap-2">
			<button
				onclick={saveWheel}
				disabled={isSaving || participants.length === 0}
				class="flex-1 px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
				</svg>
				{isSaving ? 'Saving...' : 'Save'}
			</button>
			<button
				onclick={copyLink}
				disabled={!wheelId}
				class="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
				</svg>
				Copy Link
			</button>
		</div>

		<a
			href="/"
			data-sveltekit-reload
			class="w-full px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
			class:bg-indigo-100={!darkMode}
			class:text-indigo-700={!darkMode}
			class:hover:bg-indigo-200={!darkMode}
			class:bg-indigo-950={darkMode}
			class:text-indigo-400={darkMode}
			class:hover:bg-indigo-900={darkMode}
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			New Wheel
		</a>
	</div>
{/snippet}

<main
	class="min-h-screen pt-16 pb-8 px-4 relative transition-colors duration-300 max-[900px]:min-h-0 max-[900px]:flex-1 max-[900px]:pt-8 max-[900px]:pb-8 {darkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-100 to-slate-200'}"
>
	<!-- Toggle Buttons - Fixed position -->
	<div class="fixed top-4 right-4 z-50 flex gap-2 max-[900px]:hidden">
		<!-- Dark Mode Toggle -->
		<button
			onclick={toggleDeathMode}
			class="p-2 rounded-lg shadow-md transition-colors"
			class:bg-white={!darkMode}
			class:hover:bg-gray-50={!darkMode}
			class:bg-slate-700={darkMode}
			class:hover:bg-slate-600={darkMode}
			title={darkMode ? 'Switch to Fun Mode' : 'Switch to Death Mode'}
		>
			{#if darkMode}
				<!-- Sun icon in death mode (click to switch to fun/light) -->
				<svg class="w-5 h-5" style="color: #fbbf24;" fill="currentColor" viewBox="0 0 24 24">
					<path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
				</svg>
			{:else}
				<!-- Moon icon in fun mode (click to switch to death/dark) -->
				<svg class="w-5 h-5" style="color: #6366f1;" fill="currentColor" viewBox="0 0 24 24">
					<path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/>
				</svg>
			{/if}
		</button>
		<!-- Settings Toggle -->
		<button
			onclick={() => (showPanel = !showPanel)}
			class="p-2 rounded-lg shadow-md transition-colors"
			class:bg-white={!darkMode}
			class:hover:bg-gray-50={!darkMode}
			class:bg-slate-700={darkMode}
			class:hover:bg-slate-600={darkMode}
			title={showPanel ? 'Hide settings' : 'Show settings'}
		>
			<svg class="w-5 h-5 transition-colors" class:text-gray-600={!darkMode} class:text-gray-300={darkMode} fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
		</button>
	</div>

	<!-- Center content -->
	<div class="flex flex-col items-center justify-center">
		<header class="text-center mb-8 min-[900px]:mb-12">
			{#if darkMode}
				<h1 class="text-7xl max-[900px]:text-5xl max-[800px]:text-4xl max-[500px]:text-3xl mb-4 text-white" style="font-family: 'Creepster', cursive;">Wheel of Death</h1>
				<h2 class="text-3xl max-[900px]:text-2xl max-[800px]:text-xl max-[500px]:text-lg font-semibold text-gray-400" style="font-family: 'Creepster', cursive;">{currentTagline}</h2>
			{:else}
				<h1 class="text-7xl max-[900px]:text-5xl max-[800px]:text-4xl max-[500px]:text-3xl mb-4 text-indigo-600" style="font-family: 'Fredoka', sans-serif;">Wheel of Fun</h1>
				<h2 class="text-3xl max-[900px]:text-2xl max-[800px]:text-xl max-[500px]:text-lg text-gray-500" style="font-family: 'Fredoka', sans-serif;">{currentTagline}</h2>
			{/if}
		</header>

		<div class="flex flex-col items-center gap-6">
			<Wheel
				{participants}
				size={wheelSize}
				onSpinComplete={handleSpinComplete}
				onSpinStart={handleSpinStart}
				{darkMode}
				{fastMode}
				{soundEnabled}
				{idleSpinEnabled}
				{colorScheme}
			/>

		</div>
	</div>

	<!-- Side Panel - Fixed on desktop, inline on mobile -->
	<div
		class="hidden max-[900px]:block w-full mt-8 rounded-xl shadow-lg p-6 transition-colors"
		class:bg-white={!darkMode}
		class:bg-slate-800={darkMode}
	>
		{@render settingsContent()}
	</div>

	{#if showPanel}
		<!-- Backdrop to close on click outside -->
		<button
			onclick={() => showPanel = false}
			class="fixed inset-0 z-30 max-[900px]:hidden cursor-default"
			aria-label="Close settings"
		></button>
		<div
			class="fixed rounded-xl shadow-lg p-8 z-40 overflow-y-auto transition-colors
				   top-16 right-4 w-[440px] max-h-[calc(100vh-5rem)]
				   max-[900px]:hidden"
			class:bg-white={!darkMode}
			class:bg-slate-800={darkMode}
		>
			{@render settingsContent()}
		</div>
	{/if}

	<!-- Winner Popup Modal (only in normal mode) -->
	{#if showResult && selectedParticipant}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div
				class="rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
				class:bg-white={!darkMode}
				class:bg-slate-800={darkMode}
			>
				<p
					class="text-lg tracking-wide mb-2"
					class:text-gray-500={!darkMode}
					class:text-gray-400={darkMode}
					style={darkMode ? "font-family: 'Creepster', cursive;" : ""}
				>{winnerPhrase}</p>
				<p
					class="text-5xl font-bold mb-6"
					class:text-indigo-500={!darkMode}
					class:text-red-500={darkMode}
					style={darkMode ? "font-family: 'Creepster', cursive;" : ""}
				>{selectedParticipant.name}</p>

				{#if timerEnabled}
					<div class="mb-6">
						<Timer
							duration={timerDuration}
							isRunning={isTimerRunning}
							onComplete={handleTimerComplete}
							{darkMode}
						/>
					</div>
				{/if}

				<div class="flex gap-3">
					<button
						onclick={removeFromWheel}
						class="flex-1 px-4 py-3 rounded-lg transition-colors font-medium"
						class:bg-red-100={!darkMode}
						class:text-red-700={!darkMode}
						class:hover:bg-red-200={!darkMode}
						class:bg-red-950={darkMode}
						class:text-red-400={darkMode}
						class:hover:bg-red-900={darkMode}
					>
						Remove
					</button>
					<button
						onclick={closePopup}
						class="flex-1 px-4 py-3 rounded-lg transition-colors font-medium"
						class:bg-gray-100={!darkMode}
						class:text-gray-700={!darkMode}
						class:hover:bg-gray-200={!darkMode}
						class:bg-slate-700={darkMode}
						class:text-gray-300={darkMode}
						class:hover:bg-slate-600={darkMode}
					>
						Close
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Toast Notification -->
	{#if showToast}
		<div
			class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all animate-fade-in"
			class:bg-gray-800={!darkMode}
			class:text-white={!darkMode}
			class:bg-white={darkMode}
			class:text-gray-800={darkMode}
		>
			{toastMessage}
		</div>
	{/if}

</main>

<footer
	class="py-4 px-4 min-[640px]:px-8 min-[900px]:px-16 text-sm transition-colors"
	class:bg-slate-100={!darkMode}
	class:text-gray-600={!darkMode}
	class:bg-slate-800={darkMode}
	class:text-gray-400={darkMode}
>
	<div class="flex flex-col min-[640px]:flex-row items-center justify-center min-[1100px]:justify-between gap-2 min-[640px]:gap-4 flex-wrap">
		<span class="flex items-center gap-1">Made with ❤️ and ☕ by
			<a href="https://github.com/spencer-tb" target="_blank" rel="noopener noreferrer" class="hover:opacity-70 inline-flex" title="GitHub">
				<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
			</a>
			/
			<a href="https://x.com/techbro_ccoli" target="_blank" rel="noopener noreferrer" class="hover:opacity-70 inline-flex" title="X/Twitter">
				<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
			</a>
		</span>
		<div class="flex items-center gap-2 min-[640px]:gap-4 flex-wrap justify-center text-xs min-[640px]:text-sm">
			<span class="footer-bullet-centered">•</span>
			<span>{darkMode ? '💀 Total Deaths' : '🎰 Total Spins'}: {globalSpinCount.toLocaleString()}</span>
			<span class="footer-bullet">•</span>
			<a
				href="https://buymeacoffee.com/spencertb"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:opacity-70"
			>☕ Buy me a coffee</a>
			<span class="footer-bullet">•</span>
			<a
				href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:opacity-70"
			>🚫 Don't click me</a>
			<span class="footer-bullet">•</span>
			<span>🏷️ v0.2.0</span>
		</div>
	</div>
</footer>

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
		overflow-x: hidden;
		overscroll-behavior: none;
	}

	.footer-bullet-centered {
		display: none;
	}

	@media (min-width: 640px) and (max-width: 1099px) {
		.footer-bullet-centered {
			display: inline;
		}
	}

	:global(.blood-splat) {
		position: fixed;
		width: 80px;
		height: 80px;
		pointer-events: none;
		z-index: 40;
		transform: translate(-50%, -50%) scale(var(--scale, 1)) rotate(var(--rotation, 0deg));
		animation: splat 2s ease-out forwards;
	}

	:global(.blood-splat::before) {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at center,
			#8B0000 0%,
			#660000 30%,
			#4a0000 50%,
			transparent 70%
		);
		border-radius: 50% 40% 60% 45% / 55% 50% 45% 50%;
		animation: splat-appear 0.3s ease-out forwards;
	}

	:global(.blood-splat::after) {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 20px;
		height: 60px;
		background: linear-gradient(to bottom,
			#8B0000 0%,
			#660000 40%,
			transparent 100%
		);
		border-radius: 50% 50% 40% 40%;
		transform: translateX(-50%);
		animation: drip 1.5s ease-in 0.2s forwards;
		opacity: 0;
	}

	@keyframes splat-appear {
		0% {
			transform: scale(0);
			opacity: 0;
		}
		50% {
			transform: scale(1.2);
			opacity: 1;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@keyframes drip {
		0% {
			opacity: 0.8;
			height: 20px;
		}
		100% {
			opacity: 0;
			height: 80px;
			top: 80%;
		}
	}

	@keyframes splat {
		0% {
			opacity: 1;
		}
		70% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	:global(.animate-fade-in) {
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		0% {
			opacity: 0;
			transform: translate(-50%, 10px);
		}
		100% {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}
</style>
