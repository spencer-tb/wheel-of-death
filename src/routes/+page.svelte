<script lang="ts">
	import { onMount } from 'svelte';
	import confetti from 'canvas-confetti';
	import Wheel from '$lib/components/Wheel.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import ParticipantList from '$lib/components/ParticipantList.svelte';
	import RepoStats from '$lib/components/RepoStats.svelte';
	import type { Participant } from '$lib/types';
	import { generateId, getRandomPhrase, getRandomQuestion, secureRandom } from '$lib/utils';
	import { AVENGERS_ROSTER, getAvengersPhrase, getAvengersTagline } from '$lib/avengers';
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

	function getTagline(deathMode: boolean, avengersMode: boolean = false): string {
		if (avengersMode) return getAvengersTagline();
		const list = deathMode ? DEATH_TAGLINES : FUN_TAGLINES;
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
	let deathMode = $state(data.config?.darkMode ?? false);
	let darkTheme = $state(false);
	let avengersMode = $state(data.config?.avengersMode ?? false);
	// Never saved with a wheel: nobody should open a shared link into flashing
	let headacheMode = $state(false);
	let showHeadacheWarning = $state(false);

	function toggleHeadacheMode() {
		if (headacheMode) {
			headacheMode = false;
		} else {
			showHeadacheWarning = true;
		}
	}

	function confirmHeadacheMode() {
		showHeadacheWarning = false;
		headacheMode = true;
	}

	// Buttons and the wheel edge away from the cursor, but only so far:
	// a cap on the shove keeps everything catchable
	$effect(() => {
		if (!headacheMode) return;
		const RADIUS = 110;
		const MAX_SHOVE = 48;
		const offsets = new WeakMap<HTMLElement, { x: number; y: number }>();
		let targets: HTMLElement[] = [];
		const collect = () => {
			targets = [...document.querySelectorAll<HTMLElement>('main button, .headache-wheel')];
		};
		collect();
		const observer = new MutationObserver(collect);
		observer.observe(document.body, { childList: true, subtree: true });

		const onMove = (e: MouseEvent) => {
			for (const el of targets) {
				const current = offsets.get(el) ?? { x: 0, y: 0 };
				const r = el.getBoundingClientRect();
				// Measure from where the element would be without its shove
				const cx = r.left + r.width / 2 - current.x;
				const cy = r.top + r.height / 2 - current.y;
				const dx = cx - e.clientX;
				const dy = cy - e.clientY;
				const d = Math.hypot(dx, dy) || 1;
				const reach = RADIUS + Math.max(r.width, r.height) / 2;
				let next = { x: 0, y: 0 };
				if (d < reach) {
					const shove = Math.min(MAX_SHOVE, (reach - d) * 0.6);
					next = { x: (dx / d) * shove, y: (dy / d) * shove };
				}
				if (next.x !== current.x || next.y !== current.y) {
					offsets.set(el, next);
					el.style.setProperty('--dx', `${next.x.toFixed(1)}px`);
					el.style.setProperty('--dy', `${next.y.toFixed(1)}px`);
				}
			}
		};
		window.addEventListener('mousemove', onMove, { passive: true });
		return () => {
			window.removeEventListener('mousemove', onMove);
			observer.disconnect();
			for (const el of targets) {
				el.style.removeProperty('--dx');
				el.style.removeProperty('--dy');
			}
		};
	});

	// Confetti keeps going off somewhere while headache mode is on
	$effect(() => {
		if (!headacheMode) return;
		const burst = () =>
			confetti({
				particleCount: 60,
				spread: 180,
				startVelocity: 45,
				scalar: 1.6,
				shapes: ['circle', 'square', 'star'],
				colors: ['#ff0080', '#00ff80', '#ffee00', '#00c3ff', '#ff8c00', '#8000ff'],
				origin: { x: secureRandom(), y: secureRandom() * 0.8 }
			});
		burst();
		const id = setInterval(burst, 900);
		return () => clearInterval(id);
	});

	// One theme player. It pauses when the team disassembles or Sound goes
	// off, and picks up from the same spot when either comes back.
	const AVENGERS_THEME = '/avengers/theme.m4a';
	let theme: HTMLAudioElement | null = null;

	$effect(() => {
		if (avengersMode && soundEnabled) {
			theme ??= new Audio(AVENGERS_THEME);
			theme.volume = 0.6;
			theme.play().catch(() => {
				// Browsers may block audio until the page has been interacted with
			});
		} else {
			theme?.pause();
		}
	});
	let fastMode = $state(data.config?.fastMode ?? false);
	let soundEnabled = $state(data.config?.soundEnabled ?? true);
	let idleSpinEnabled = $state(data.config?.idleSpinEnabled ?? true);
	let colorScheme = $state<'default' | 'rainbow' | 'pastel' | 'ocean' | 'sunset'>(data.config?.colorScheme || 'default');
	let currentTagline = $state(getTagline(data.config?.darkMode ?? false, data.config?.avengersMode ?? false));
	let showToast = $state(false);
	let toastMessage = $state('');
	let icebreakerEnabled = $state(false);
	let currentQuestion = $state('');

	// isDark is true when either dark theme or death mode is active
	const isDark = $derived(darkTheme || deathMode);

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
			// Never below a sane minimum, even if the viewport reports a silly width
			wheelSize = isMobile ? Math.max(160, Math.min(window.innerWidth - 40, 500)) : 750;
		}
		updateSize();
		window.addEventListener('resize', updateSize);

		// Initialize dark theme from localStorage or system preference
		const stored = localStorage.getItem('darkTheme');
		if (stored !== null) {
			darkTheme = stored === 'true';
		} else {
			darkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
		}

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
					darkMode: deathMode,
					fastMode,
					soundEnabled,
					idleSpinEnabled,
					avengersMode,
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
		if (deathMode) return;

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
		winnerPhrase = avengersMode ? getAvengersPhrase(participant.image) : getRandomPhrase(deathMode);
		if (icebreakerEnabled) {
			currentQuestion = getRandomQuestion(deathMode);
		}

		// Same behavior for both modes, just different spin speed
		showResult = true;
		if (timerEnabled) {
			isTimerRunning = true;
		}
		pendingRemoval = participant.id;

		// Fire effects!
		if (deathMode) {
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

	function toggleDarkTheme() {
		darkTheme = !darkTheme;
		localStorage.setItem('darkTheme', String(darkTheme));
	}

	function toggleDeathMode() {
		deathMode = !deathMode;
		currentTagline = getTagline(deathMode, avengersMode);

		// Clear custom colors when switching modes
		participants = participants.map(p => ({ ...p, color: undefined }));

		// Only swap names if user hasn't edited them; the team stays assembled
		if (!namesEdited && !avengersMode) {
			participants = createParticipants(deathMode ? DEATH_NAMES : NORMAL_NAMES);
		}
	}

	// Like death mode, this only decides who is on the wheel
	function toggleAvengersMode() {
		avengersMode = !avengersMode;
		participants = avengersMode
			? AVENGERS_ROSTER.map((member) => ({
					id: generateId(),
					name: member.name,
					active: true,
					image: member.image
				}))
			: createParticipants(deathMode ? DEATH_NAMES : NORMAL_NAMES);
		namesEdited = false;
		currentTagline = getTagline(deathMode, avengersMode);
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
	<title>{deathMode ? '🪦 Wheel of Death' : '🎉 Wheel of Fun'}</title>
</svelte:head>

{#snippet letters(text: string)}
	{#each text.split('') as ch, i (i)}
		<span class="letter" style="--i: {i}">{ch === ' ' ? '\u00a0' : ch}</span>
	{/each}
{/snippet}

{#snippet settingsContent()}
	<!-- Participants Section -->
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-xl font-semibold" class:text-gray-800={!isDark} class:text-white={isDark}>Participants</h2>
		<div class="flex items-center gap-2">
			<button
				onclick={() => showPanel = false}
				class="hidden min-[900px]:block text-xs px-2 py-1 rounded transition-colors"
				class:text-gray-500={!isDark}
				class:hover:text-gray-700={!isDark}
				class:hover:bg-gray-100={!isDark}
				class:text-gray-400={isDark}
				class:hover:text-gray-300={isDark}
				class:hover:bg-slate-700={isDark}
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
			<span class="text-xs px-2 py-1 rounded-full" class:text-gray-500={!isDark} class:bg-gray-100={!isDark} class:text-gray-400={isDark} class:bg-slate-700={isDark}>
				{activeCount}/{participants.length}
			</span>
		</div>
	</div>

	<ParticipantList
		{participants}
		darkMode={isDark}
		{deathMode}
		onUpdate={handleParticipantsUpdate}
		onNotify={toast}
	/>

	<!-- Settings Section -->
	<div class="mt-5 pt-5 border-t" class:border-gray-200={!isDark} class:border-slate-700={isDark}>
		<h3 class="text-lg font-semibold mb-4" class:text-gray-700={!isDark} class:text-gray-300={isDark}>Settings</h3>

		<!-- Fast Mode Toggle -->
		<div class="flex items-center justify-between mb-3">
			<span class="text-sm" class:text-gray-600={!isDark} class:text-gray-400={isDark}>Fast Spin</span>
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
			<span class="text-sm" class:text-gray-600={!isDark} class:text-gray-400={isDark}>Sound</span>
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
			<span class="text-sm" class:text-gray-600={!isDark} class:text-gray-400={isDark}>Background Spin</span>
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
			<span class="text-sm" class:text-gray-600={!isDark} class:text-gray-400={isDark}>Timer</span>
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

		<!-- Icebreaker Toggle -->
		<div class="flex items-center justify-between mb-3">
			<span class="text-sm" class:text-gray-600={!isDark} class:text-gray-400={isDark}>Fun Questions</span>
			<button
				onclick={() => { icebreakerEnabled = !icebreakerEnabled; }}
				class="relative w-11 h-6 rounded-full transition-colors"
				class:bg-amber-500={icebreakerEnabled}
				class:bg-gray-300={!icebreakerEnabled}
			>
				<span
					class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
					class:translate-x-5={icebreakerEnabled}
				></span>
			</button>
		</div>

		<!-- Timer Duration -->
		{#if timerEnabled}
			<div class="mb-3">
				<label class="text-sm block mb-1" class:text-gray-600={!isDark} class:text-gray-400={isDark}>Duration (seconds)</label>
				<input
					type="number"
					bind:value={timerDuration}
					min="10"
					max="600"
					class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
					class:border-gray-300={!isDark}
					class:bg-white={!isDark}
					class:border-slate-600={isDark}
					class:bg-slate-700={isDark}
					class:text-white={isDark}
				/>
			</div>
		{/if}

	</div>

	<!-- Actions -->
	<div class="mt-3 pt-3 border-t space-y-2" class:border-gray-100={!isDark} class:border-slate-700={isDark}>
		{#if participants.some((p) => !p.active)}
			<button
				onclick={resetAll}
				class="w-full px-3 py-2 text-sm rounded-lg transition-colors"
				class:bg-gray-100={!isDark}
				class:text-gray-700={!isDark}
				class:hover:bg-gray-200={!isDark}
				class:bg-slate-700={isDark}
				class:text-gray-300={isDark}
				class:hover:bg-slate-600={isDark}
			>
				Reset All
			</button>
		{/if}

		{#if participants.length > 0}
			<button
				onclick={clearAll}
				class="w-full px-3 py-2 text-sm rounded-lg transition-colors"
				class:bg-red-100={!isDark}
				class:text-red-700={!isDark}
				class:hover:bg-red-200={!isDark}
				class:bg-red-950={isDark}
				class:text-red-400={isDark}
				class:hover:bg-red-900={isDark}
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
			class:bg-indigo-100={!isDark}
			class:text-indigo-700={!isDark}
			class:hover:bg-indigo-200={!isDark}
			class:bg-indigo-950={isDark}
			class:text-indigo-400={isDark}
			class:hover:bg-indigo-900={isDark}
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			New Wheel
		</a>
	</div>
{/snippet}

<main
	class="min-h-screen pt-16 pb-8 px-4 relative transition-colors duration-300 max-[900px]:min-h-0 max-[900px]:flex-1 max-[900px]:pt-8 max-[900px]:pb-8 {isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-100 to-slate-200'}"
	class:headache={headacheMode}
>
	{#if headacheMode}
		<!-- Colour flashes and a periodic inversion over everything but the modals -->
		<div class="headache-flash fixed inset-0 z-[45] pointer-events-none"></div>
		<div class="headache-invert fixed inset-0 z-[45] pointer-events-none"></div>
	{/if}
	<!-- Toggle Buttons - Fixed position -->
	<!-- Mode and theme buttons: pinned top right on desktop, a row above the title on phones -->
	<div class="fixed top-4 right-4 z-50 flex gap-2 max-[900px]:static max-[900px]:justify-center max-[900px]:mb-6">
		<!-- Death Mode Toggle -->
		<button
			onclick={toggleDeathMode}
			class="p-2 rounded-lg shadow-md transition-colors"
			class:bg-white={!isDark && !deathMode}
			class:hover:bg-gray-50={!isDark && !deathMode}
			class:bg-slate-700={isDark && !deathMode}
			class:hover:bg-slate-600={isDark && !deathMode}
			class:bg-red-900={deathMode}
			class:hover:bg-red-800={deathMode}
			title={deathMode ? 'Leave Death Mode' : 'Enter Death Mode'}
		>
			<span class="block w-5 h-5 text-center text-base leading-5 transition-all" class:grayscale={!deathMode} class:opacity-60={!deathMode}>💀</span>
		</button>
		<!-- Avengers Mode Toggle -->
		<button
			onclick={toggleAvengersMode}
			class="p-2 rounded-lg shadow-md transition-colors"
			class:bg-white={!isDark && !avengersMode}
			class:hover:bg-gray-50={!isDark && !avengersMode}
			class:bg-slate-700={isDark && !avengersMode}
			class:hover:bg-slate-600={isDark && !avengersMode}
			class:bg-red-700={avengersMode}
			class:hover:bg-red-600={avengersMode}
			title={avengersMode ? 'Disassemble' : 'Avengers, assemble!'}
		>
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" class:text-red-600={!avengersMode} class:text-white={avengersMode}>
				<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2.2a7.8 7.8 0 1 1 0 15.6 7.8 7.8 0 0 1 0-15.6z" />
				<path fill-rule="evenodd" d="M11 5.5h2.2l4.4 11.3h-2.3l-1-2.7H9.7l-1 2.7H6.4L11 5.5zm1 3L10.5 12.2h3L12 8.5z" />
				<path d="M15.8 16.4l5.8 2.2-3.6 3.8-2.2-6z" />
			</svg>
		</button>
		<!-- Headache Mode Toggle -->
		<button
			onclick={toggleHeadacheMode}
			class="p-2 rounded-lg shadow-md transition-colors"
			class:bg-white={!isDark && !headacheMode}
			class:hover:bg-gray-50={!isDark && !headacheMode}
			class:bg-slate-700={isDark && !headacheMode}
			class:hover:bg-slate-600={isDark && !headacheMode}
			class:bg-fuchsia-600={headacheMode}
			class:hover:bg-fuchsia-500={headacheMode}
			title={headacheMode ? 'Leave Headache Mode' : 'Enter Headache Mode'}
		>
			<span class="block w-5 h-5 text-center text-base leading-5 transition-all" class:grayscale={!headacheMode} class:opacity-60={!headacheMode}>🤯</span>
		</button>
		<!-- Dark Theme Toggle -->
		<button
			onclick={toggleDarkTheme}
			class="p-2 rounded-lg shadow-md transition-colors"
			class:bg-white={!isDark}
			class:hover:bg-gray-50={!isDark}
			class:bg-slate-700={isDark}
			class:hover:bg-slate-600={isDark}
			title={darkTheme ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
		>
			{#if isDark}
				<!-- Sun icon (click to switch to light) -->
				<svg class="w-5 h-5" style="color: #fbbf24;" fill="currentColor" viewBox="0 0 24 24">
					<path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
				</svg>
			{:else}
				<!-- Moon icon (click to switch to dark) -->
				<svg class="w-5 h-5" style="color: #6366f1;" fill="currentColor" viewBox="0 0 24 24">
					<path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/>
				</svg>
			{/if}
		</button>
		<!-- Settings Toggle (desktop only; the panel is inline on phones) -->
		<button
			onclick={() => (showPanel = !showPanel)}
			class="p-2 rounded-lg shadow-md transition-colors max-[900px]:hidden"
			class:bg-white={!isDark}
			class:hover:bg-gray-50={!isDark}
			class:bg-slate-700={isDark}
			class:hover:bg-slate-600={isDark}
			title={showPanel ? 'Hide settings' : 'Show settings'}
		>
			<svg class="w-5 h-5 transition-colors" class:text-gray-600={!isDark} class:text-gray-300={isDark} fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
		</button>
	</div>

	<!-- Center content -->
	<div class="flex flex-col items-center justify-center" class:headache-shake={headacheMode}>
		<header class="text-center mb-8 min-[900px]:mb-12" class:headache-header={headacheMode}>
			{#if deathMode}
				<h1 class="text-7xl max-[900px]:text-5xl max-[800px]:text-4xl max-[500px]:text-3xl mb-4 text-white" style="font-family: 'Creepster', cursive;">{#if headacheMode}{@render letters('Wheel of Death')}{:else}Wheel of Death{/if}</h1>
				<h2 class="text-3xl max-[900px]:text-2xl max-[800px]:text-xl max-[500px]:text-lg font-semibold text-gray-400" style="font-family: 'Creepster', cursive;">{#if headacheMode}{@render letters(currentTagline)}{:else}{currentTagline}{/if}</h2>
			{:else}
				<h1 class="text-7xl max-[900px]:text-5xl max-[800px]:text-4xl max-[500px]:text-3xl mb-4" class:text-indigo-600={!isDark} class:text-indigo-400={isDark} style="font-family: 'Fredoka', sans-serif;">{#if headacheMode}{@render letters('Wheel of Fun')}{:else}Wheel of Fun{/if}</h1>
				<h2 class="text-3xl max-[900px]:text-2xl max-[800px]:text-xl max-[500px]:text-lg" class:text-gray-500={!isDark} class:text-gray-400={isDark} style="font-family: 'Fredoka', sans-serif;">{#if headacheMode}{@render letters(currentTagline)}{:else}{currentTagline}{/if}</h2>
			{/if}
		</header>

		<div class="flex flex-col items-center gap-6" class:headache-wheel={headacheMode}>
			<Wheel
				{participants}
				size={wheelSize}
				onSpinComplete={handleSpinComplete}
				onSpinStart={handleSpinStart}
				darkMode={isDark}
				{deathMode}
				{fastMode}
				{soundEnabled}
				{idleSpinEnabled}
				{avengersMode}
				{headacheMode}
				{colorScheme}
			/>

		</div>
	</div>

	<!-- Side Panel - Fixed on desktop, inline on mobile -->
	<div
		class="hidden max-[900px]:block w-full mt-8 rounded-xl shadow-lg p-6 transition-colors"
		class:bg-white={!isDark}
		class:bg-slate-800={isDark}
		class:headache-wobble={headacheMode}
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
			class:headache-wobble={headacheMode}
			class="fixed rounded-xl shadow-lg p-8 z-40 overflow-y-auto transition-colors
				   top-16 right-4 w-[440px] max-h-[calc(100vh-5rem)]
				   max-[900px]:hidden"
			class:bg-white={!isDark}
			class:bg-slate-800={isDark}
		>
			{@render settingsContent()}
		</div>
	{/if}

	<!-- Winner Popup Modal -->
	{#if showResult && selectedParticipant}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div
				class="rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
				class:bg-white={!isDark}
				class:bg-slate-800={isDark}
				class:headache-card={headacheMode}
			>
				<p
					class="text-lg tracking-wide mb-2"
					class:text-gray-500={!isDark}
					class:text-gray-400={isDark}
					style={deathMode ? "font-family: 'Creepster', cursive;" : ""}
				>{winnerPhrase}</p>
				{#if selectedParticipant.image}
					<img
						src={selectedParticipant.image}
						alt=""
						class="w-28 h-28 rounded-full object-cover mx-auto mb-4 border-4 shadow-lg"
						class:border-indigo-200={!isDark}
						class:border-slate-600={isDark && !deathMode}
						class:border-red-800={deathMode}
					/>
				{/if}
				<p
					class="text-5xl font-bold"
					class:mb-6={!icebreakerEnabled}
					class:mb-4={icebreakerEnabled}
					class:text-indigo-500={!deathMode}
					class:text-red-500={deathMode}
					style={deathMode ? "font-family: 'Creepster', cursive;" : ""}
				>{#if headacheMode}{@render letters(selectedParticipant.name)}{:else}{selectedParticipant.name}{/if}</p>

				{#if icebreakerEnabled && currentQuestion}
					<div
						class="mb-5 mx-2 px-4 py-3 rounded-xl"
						class:bg-amber-50={!isDark}
						class:border-amber-200={!isDark}
						class:border-purple-800={deathMode}
						style="border: 1px solid; {deathMode ? 'background: rgb(59 7 100 / 0.5);' : isDark ? 'background: rgb(30 41 59 / 0.8); border-color: rgb(71 85 105);' : ''}"
					>
						<p class="text-xs uppercase tracking-wider mb-1"
							class:text-amber-500={!deathMode}
							class:text-purple-400={deathMode}
						>{deathMode ? '🔮 Answer this...' : '🎲 Answer this...'}</p>
						<p class="text-base font-medium"
							class:text-amber-900={!isDark}
							class:text-purple-200={deathMode}
							class:text-slate-200={isDark && !deathMode}
							style={deathMode ? "font-family: 'Creepster', cursive;" : ""}
						>{currentQuestion}</p>
					</div>
				{/if}

				{#if timerEnabled}
					<div class="mb-6">
						<Timer
							duration={timerDuration}
							isRunning={isTimerRunning}
							onComplete={handleTimerComplete}
							darkMode={isDark}
						/>
					</div>
				{/if}

				<div class="flex gap-3">
					<button
						onclick={removeFromWheel}
						class="flex-1 px-4 py-3 rounded-lg transition-colors font-medium"
						class:bg-red-100={!isDark}
						class:text-red-700={!isDark}
						class:hover:bg-red-200={!isDark}
						class:bg-red-950={isDark}
						class:text-red-400={isDark}
						class:hover:bg-red-900={isDark}
					>
						Remove
					</button>
					<button
						onclick={closePopup}
						class="flex-1 px-4 py-3 rounded-lg transition-colors font-medium"
						class:bg-gray-100={!isDark}
						class:text-gray-700={!isDark}
						class:hover:bg-gray-200={!isDark}
						class:bg-slate-700={isDark}
						class:text-gray-300={isDark}
						class:hover:bg-slate-600={isDark}
					>
						Close
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Headache Mode warning -->
	{#if showHeadacheWarning}
		<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
			<div
				class="rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
				class:bg-white={!isDark}
				class:bg-slate-800={isDark}
			>
				<p class="text-4xl mb-3">⚠️</p>
				<h2 class="text-2xl font-bold mb-3" class:text-gray-900={!isDark} class:text-white={isDark}>Are you sure?</h2>
				<p class="text-sm mb-2" class:text-gray-600={!isDark} class:text-gray-300={isDark}>
					Headache mode flashes colours, inverts the screen, shakes everything, makes buttons dodge your cursor, and sends the wheel bouncing around the page while it spins backwards.
				</p>
				<p class="text-sm font-semibold mb-6" class:text-red-600={!isDark} class:text-red-400={isDark}>
					Not recommended for anyone with epilepsy or photosensitivity.
				</p>
				<div class="flex gap-3">
					<button
						onclick={() => (showHeadacheWarning = false)}
						class="flex-1 px-4 py-3 rounded-lg transition-colors font-medium"
						class:bg-gray-100={!isDark}
						class:text-gray-700={!isDark}
						class:hover:bg-gray-200={!isDark}
						class:bg-slate-700={isDark}
						class:text-gray-300={isDark}
						class:hover:bg-slate-600={isDark}
					>
						No thanks
					</button>
					<button
						onclick={confirmHeadacheMode}
						class="flex-1 px-4 py-3 rounded-lg transition-colors font-medium bg-fuchsia-600 text-white hover:bg-fuchsia-500"
					>
						I'm sure
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Toast Notification -->
	{#if showToast}
		<div
			class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all animate-fade-in"
			class:bg-gray-800={!isDark}
			class:text-white={!isDark}
			class:bg-white={isDark}
			class:text-gray-800={isDark}
		>
			{toastMessage}
		</div>
	{/if}

</main>

<RepoStats darkMode={isDark} panelOpen={showPanel} />

<footer
	class="py-4 px-4 min-[640px]:px-8 min-[900px]:px-16 text-sm transition-colors"
	class:bg-slate-100={!isDark}
	class:text-gray-600={!isDark}
	class:bg-slate-800={isDark}
	class:text-gray-400={isDark}
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
			<span>{deathMode ? '💀 Total Deaths' : '🎰 Total Spins'}: {globalSpinCount.toLocaleString()}</span>
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
			<span>🏷️ v0.4.0</span>
		</div>
	</div>
</footer>

<style>
	/* clip, not hidden: hidden turns body into a scroll container that can
	   never scroll, and overscroll-behavior then blocks the page from
	   scrolling at all under touch and wheel input */
	:global(html, body) {
		margin: 0;
		padding: 0;
		overflow-x: clip;
		overscroll-behavior: none;
	}

	.footer-bullet-centered {
		display: none;
	}

	/* Headache mode. Transforms and filters only go on elements that have no
	   fixed-position descendants, since either would re-anchor them. */
	:global(main.headache) {
		background: linear-gradient(270deg, #ff0080, #ff8c00, #ffee00, #00ff80, #00c3ff, #8000ff, #ff0080);
		background-size: 1400% 1400%;
		animation: headache-bg 1.2s ease-in-out infinite alternate;
		cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36'><text y='30' font-size='30'>%F0%9F%A4%AF</text></svg>") 18 18, crosshair;
	}

	:global(.headache-shake) {
		animation: headache-shake 0.11s linear infinite alternate, headache-zoom 0.9s ease-in-out infinite alternate;
	}

	:global(.headache-flash) {
		animation: headache-flash 1.33s steps(1, end) infinite;
	}

	:global(.headache-invert) {
		background: #fff;
		mix-blend-mode: difference;
		animation: headache-invert 2s steps(1, end) infinite;
	}

	:global(.headache-wheel) {
		animation:
			headache-hue-blur 1s linear infinite,
			headache-wobble 0.7s ease-in-out infinite alternate,
			headache-flip 2.7s steps(1, end) infinite;
	}

	:global(.headache-header) {
		animation: headache-hue 0.8s linear infinite reverse, headache-text 0.35s ease-in-out infinite alternate;
	}

	:global(.headache-header h2) {
		animation: headache-mirror 0.9s steps(1, end) infinite, headache-bob 0.45s ease-in-out infinite alternate;
	}

	:global(.headache-wobble) {
		animation:
			headache-wobble-soft 0.9s ease-in-out infinite alternate,
			headache-hue 2s linear infinite,
			headache-flip 4.1s steps(1, end) 1.3s infinite;
	}

	:global(main.headache li) {
		animation: headache-drift 0.45s ease-in-out infinite alternate;
	}

	:global(main.headache li:nth-child(odd)) {
		animation-direction: alternate-reverse;
	}

	:global(main.headache button) {
		animation: headache-tilt 0.4s ease-in-out infinite alternate;
	}

	:global(.headache-card) {
		animation:
			headache-card-in 1.4s cubic-bezier(0.3, 0.9, 0.3, 1.1) both,
			headache-card-wobble 1.6s ease-in-out 1.4s infinite,
			headache-hue-blur 0.6s linear infinite;
	}

	:global(.headache-card p) {
		animation: headache-text 0.3s ease-in-out infinite alternate;
	}

	/* Every bit of text wanders on its own clock */
	:global(main.headache :is(p, h3, li, label)) {
		animation: headache-jitter 0.5s ease-in-out infinite alternate;
	}

	:global(main.headache :is(span:not(.letter):not(.flex), a, strong)) {
		display: inline-block;
		animation: headache-jitter 0.5s ease-in-out infinite alternate;
	}

	:global(main.headache :is(p, h3, li, label, span:not(.letter):not(.flex), a, strong):nth-child(2n)) {
		animation-delay: -0.17s;
		animation-direction: alternate-reverse;
	}

	:global(main.headache :is(p, h3, li, label, span:not(.letter):not(.flex), a, strong):nth-child(3n)) {
		animation-delay: -0.31s;
		animation-duration: 0.37s;
	}

	:global(main.headache :is(p, h3, li, label, span:not(.letter):not(.flex), a, strong):nth-child(5n)) {
		animation-delay: -0.09s;
		animation-duration: 0.63s;
	}

	:global(.letter) {
		display: inline-block;
		color: hsl(calc(var(--i) * 47deg) 100% 50%);
		animation: headache-letter 0.55s ease-in-out infinite alternate;
		animation-delay: calc(var(--i) * -0.137s);
	}

	:global(.letter:nth-child(2n)) {
		animation-direction: alternate-reverse;
		animation-duration: 0.43s;
	}

	:global(.headache-card button) {
		animation: headache-tilt 0.25s ease-in-out infinite alternate, headache-bob 0.5s ease-in-out infinite alternate-reverse;
	}

	@keyframes headache-bg {
		from { background-position: 0% 50%; }
		to { background-position: 100% 50%; }
	}

	@keyframes headache-flash {
		0% { background: rgba(255, 0, 0, 0.45); }
		25% { background: rgba(0, 255, 0, 0.45); }
		50% { background: rgba(0, 0, 255, 0.45); }
		75% { background: rgba(255, 255, 0, 0.45); }
	}

	@keyframes headache-invert {
		0%, 84% { opacity: 0; }
		85%, 100% { opacity: 1; }
	}

	@keyframes headache-hue {
		to { filter: hue-rotate(360deg); }
	}

	@keyframes headache-hue-blur {
		0% { filter: hue-rotate(0deg) blur(0); }
		50% { filter: hue-rotate(180deg) blur(3px) contrast(1.6); }
		100% { filter: hue-rotate(360deg) blur(0); }
	}

	@keyframes headache-shake {
		from { translate: -7px 5px; }
		to { translate: 7px -5px; }
	}

	@keyframes headache-zoom {
		from { scale: 0.9; }
		to { scale: 1.14; }
	}

	/* Mirror-flip for a moment every cycle; scale composes with transform */
	@keyframes headache-flip {
		0% { scale: 1 1; }
		60% { scale: -1 1; }
		72% { scale: 1 1; }
	}

	@keyframes headache-wobble {
		from { transform: translate(var(--dx, 0px), var(--dy, 0px)) rotate(-9deg) scale(0.9) skew(-6deg) translateX(-14px); }
		to { transform: translate(var(--dx, 0px), var(--dy, 0px)) rotate(9deg) scale(1.1) skew(6deg) translateX(14px); }
	}

	@keyframes headache-wobble-soft {
		from { transform: rotate(-3deg) translate(-14px, -10px); }
		to { transform: rotate(3deg) translate(14px, 10px); }
	}

	@keyframes headache-text {
		from { transform: skew(-22deg, 4deg) translateX(-18px) scale(0.92); letter-spacing: -3px; }
		to { transform: skew(22deg, -4deg) translateX(18px) scale(1.1); letter-spacing: 8px; }
	}

	@keyframes headache-jitter {
		from { transform: translate(-7px, -5px) rotate(-6deg); }
		to { transform: translate(7px, 5px) rotate(6deg); }
	}

	@keyframes headache-letter {
		0% { transform: translate(-8px, -18px) rotate(-30deg) scale(0.75); }
		50% { transform: translate(10px, 12px) rotate(25deg) scale(1.4); }
		100% { transform: translate(-5px, 16px) rotate(-12deg) scale(1.05); }
	}

	@keyframes headache-bob {
		from { translate: 0 -10px; }
		to { translate: 0 10px; }
	}

	@keyframes headache-mirror {
		0% { transform: scaleX(1); }
		50% { transform: scaleX(-1); }
	}

	@keyframes headache-drift {
		from { transform: translateX(-18px) rotate(-2deg); }
		to { transform: translateX(18px) rotate(2deg); }
	}

	@keyframes headache-tilt {
		from { transform: translate(var(--dx, 0px), var(--dy, 0px)) rotate(-15deg) scale(0.95); }
		to { transform: translate(var(--dx, 0px), var(--dy, 0px)) rotate(15deg) scale(1.08); }
	}

	@keyframes headache-card-in {
		from { transform: rotate(-1440deg) scale(0) translateY(-600px); }
		to { transform: rotate(0deg) scale(1) translateY(0); }
	}

	/* Not a pendulum: every quarter lands somewhere different, with a flip */
	@keyframes headache-card-wobble {
		0% { transform: rotate(-18deg) scale(0.85) translate(-40px, 20px); }
		20% { transform: rotate(14deg) scale(1.2) translate(50px, -30px) skew(8deg); }
		40% { transform: rotate(-6deg) scale(1) translate(-20px, 50px) rotateY(180deg); }
		55% { transform: rotate(22deg) scale(0.9) translate(60px, 10px) rotateY(360deg); }
		75% { transform: rotate(-25deg) scale(1.15) translate(-60px, -40px) skew(-10deg); }
		90% { transform: rotate(8deg) scale(0.8) translate(30px, 40px) rotateX(180deg); }
		100% { transform: rotate(-18deg) scale(0.85) translate(-40px, 20px) rotateX(360deg); }
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
