<script lang="ts">
	import { formatTime } from '$lib/utils';

	interface Props {
		duration: number; // total seconds
		isRunning: boolean;
		onComplete: () => void;
		darkMode?: boolean;
	}

	let { duration, isRunning, onComplete, darkMode = false }: Props = $props();

	let timeRemaining = $state(duration);
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let isFinished = $state(false);
	let flashCount = $state(0);

	function playBeep() {
		try {
			const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

			// Play 3 beeps
			[0, 200, 400].forEach((delay) => {
				setTimeout(() => {
					const oscillator = audioContext.createOscillator();
					const gainNode = audioContext.createGain();

					oscillator.connect(gainNode);
					gainNode.connect(audioContext.destination);

					oscillator.frequency.value = 800;
					oscillator.type = 'sine';

					gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
					gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

					oscillator.start(audioContext.currentTime);
					oscillator.stop(audioContext.currentTime + 0.15);
				}, delay);
			});
		} catch (e) {
			// Audio not supported
			console.log('Audio not supported');
		}
	}

	let flashInterval: ReturnType<typeof setInterval> | null = null;

	function startFlashing() {
		isFinished = true;
		flashCount = 0;

		flashInterval = setInterval(() => {
			flashCount++;
		}, 300);
	}

	function stopFlashing() {
		if (flashInterval) {
			clearInterval(flashInterval);
			flashInterval = null;
		}
		isFinished = false;
	}

	// Track if we just started running (to reset state only on new timer start)
	let wasRunning = false;

	$effect(() => {
		// Only reset when timer starts fresh (transition from not running to running)
		if (isRunning && !wasRunning) {
			timeRemaining = duration;
			isFinished = false;
			if (flashInterval) {
				clearInterval(flashInterval);
				flashInterval = null;
			}
		}
		wasRunning = isRunning;
	});

	$effect(() => {
		if (isRunning) {
			intervalId = setInterval(() => {
				timeRemaining -= 1;
				if (timeRemaining <= 0) {
					if (intervalId) {
						clearInterval(intervalId);
						intervalId = null;
					}
					playBeep();
					startFlashing();
					onComplete();
				}
			}, 1000);

			return () => {
				if (intervalId) {
					clearInterval(intervalId);
					intervalId = null;
				}
			};
		}
	});

	const progress = $derived(timeRemaining / duration);
	const isLow = $derived(timeRemaining <= 10);
	const isFlashVisible = $derived(flashCount % 2 === 0);
</script>

<div class="flex flex-col items-center gap-2">
	<div
		class="text-6xl font-mono font-bold tabular-nums transition-colors"
		class:text-red-500={isLow && isRunning}
		class:text-gray-700={!isLow && !isFinished && !darkMode}
		class:text-gray-200={!isLow && !isFinished && darkMode}
		class:text-red-600={isFinished && isFlashVisible}
		class:text-transparent={isFinished && !isFlashVisible}
		class:animate-pulse={isFinished}
	>
		{formatTime(timeRemaining)}
	</div>

	{#if isRunning || isFinished}
		<div class="w-64 h-2 rounded-full overflow-hidden" class:bg-gray-200={!darkMode} class:bg-slate-600={darkMode}>
			<div
				class="h-full transition-all duration-1000 ease-linear rounded-full"
				class:bg-red-500={isLow}
				class:bg-indigo-500={!isLow}
				style="width: {progress * 100}%"
			></div>
		</div>
	{/if}
</div>
