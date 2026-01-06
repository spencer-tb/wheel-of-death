<script lang="ts">
	import { onMount } from 'svelte';
	import type { Participant } from '$lib/types';
	import { getSliceColor, secureRandom } from '$lib/utils';

	interface Props {
		participants: Participant[];
		onSpinComplete: (participant: Participant) => void;
		onSpinStart: () => void;
		size?: number;
		onHover?: (hovering: boolean) => void;
		darkMode?: boolean;
		fastMode?: boolean;
		soundEnabled?: boolean;
		colorScheme?: 'default' | 'rainbow' | 'pastel' | 'ocean' | 'sunset';
		idleSpinEnabled?: boolean;
	}

	let { participants, onSpinComplete, onSpinStart, size = 400, onHover, darkMode = true, fastMode = false, soundEnabled = true, colorScheme = 'default', idleSpinEnabled = true }: Props = $props();

	let canvas: HTMLCanvasElement;
	let isSpinning = $state(false);
	let currentRotation = $state(0);
	let dpr = $state(1);
	let actualSize = $state(400);
	let idleAnimationId: number | null = null;
	let isHovering = $state(false);
	let audioContext: AudioContext | null = null;
	let audioUnlocked = false;

	// Initialize/resume audio context on user interaction (required for mobile/iOS)
	function initAudio() {
		if (!audioContext) {
			audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
		}
		if (audioContext.state === 'suspended') {
			audioContext.resume();
		}

		// iOS requires playing a sound directly from user gesture to unlock audio
		if (!audioUnlocked && audioContext) {
			const silentOsc = audioContext.createOscillator();
			const silentGain = audioContext.createGain();
			silentGain.gain.value = 0.001; // Nearly silent
			silentOsc.connect(silentGain);
			silentGain.connect(audioContext.destination);
			silentOsc.start();
			silentOsc.stop(audioContext.currentTime + 0.001);
			audioUnlocked = true;
		}
	}

	$effect(() => {
		actualSize = size;
		if (canvas) {
			setupCanvas();
			const ctx = canvas.getContext('2d');
			if (ctx) {
				drawWheel(ctx, currentRotation);
			}
		}
	});

	function playSpinSound() {
		if (!soundEnabled) return;
		try {
			initAudio();
			// Creepy whoosh sound
			const oscillator = audioContext!.createOscillator();
			const gainNode = audioContext.createGain();
			oscillator.connect(gainNode);
			gainNode.connect(audioContext.destination);
			oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
			oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
			oscillator.type = 'sawtooth';
			gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
			gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
			oscillator.start(audioContext.currentTime);
			oscillator.stop(audioContext.currentTime + 0.5);
		} catch (e) {
			console.log('Audio not supported');
		}
	}

	// 20 Fun celebration sound patterns
	const FUN_SOUNDS = [
		// 1. Classic fanfare
		[{ freq: 523, delay: 0, dur: 0.15 }, { freq: 523, delay: 100, dur: 0.15 }, { freq: 523, delay: 200, dur: 0.15 }, { freq: 659, delay: 300, dur: 0.4 }, { freq: 784, delay: 700, dur: 0.5 }],
		// 2. Ascending triumph
		[{ freq: 392, delay: 0, dur: 0.2 }, { freq: 494, delay: 150, dur: 0.2 }, { freq: 587, delay: 300, dur: 0.2 }, { freq: 784, delay: 450, dur: 0.4 }],
		// 3. Happy bounce
		[{ freq: 880, delay: 0, dur: 0.1 }, { freq: 660, delay: 80, dur: 0.1 }, { freq: 880, delay: 160, dur: 0.1 }, { freq: 1100, delay: 300, dur: 0.3 }],
		// 4. Victory chime
		[{ freq: 1047, delay: 0, dur: 0.15 }, { freq: 880, delay: 100, dur: 0.15 }, { freq: 1047, delay: 200, dur: 0.15 }, { freq: 1319, delay: 350, dur: 0.4 }],
		// 5. Sparkle burst
		[{ freq: 1200, delay: 0, dur: 0.08 }, { freq: 1400, delay: 50, dur: 0.08 }, { freq: 1600, delay: 100, dur: 0.08 }, { freq: 1800, delay: 150, dur: 0.15 }],
		// 6. Major chord bloom
		[{ freq: 523, delay: 0, dur: 0.4 }, { freq: 659, delay: 0, dur: 0.4 }, { freq: 784, delay: 0, dur: 0.4 }, { freq: 1047, delay: 200, dur: 0.3 }],
		// 7. Playful boing
		[{ freq: 300, delay: 0, dur: 0.15 }, { freq: 600, delay: 100, dur: 0.1 }, { freq: 400, delay: 180, dur: 0.1 }, { freq: 800, delay: 260, dur: 0.25 }],
		// 8. Celebration cascade
		[{ freq: 659, delay: 0, dur: 0.1 }, { freq: 784, delay: 80, dur: 0.1 }, { freq: 988, delay: 160, dur: 0.1 }, { freq: 1175, delay: 240, dur: 0.1 }, { freq: 1319, delay: 320, dur: 0.3 }],
		// 9. Cheerful ping
		[{ freq: 1000, delay: 0, dur: 0.12 }, { freq: 1250, delay: 120, dur: 0.12 }, { freq: 1500, delay: 240, dur: 0.25 }],
		// 10. Triumphant horn
		[{ freq: 440, delay: 0, dur: 0.3 }, { freq: 554, delay: 250, dur: 0.3 }, { freq: 659, delay: 500, dur: 0.5 }],
		// 11. Starburst
		[{ freq: 2000, delay: 0, dur: 0.05 }, { freq: 1800, delay: 40, dur: 0.05 }, { freq: 2200, delay: 80, dur: 0.05 }, { freq: 1600, delay: 120, dur: 0.1 }, { freq: 2400, delay: 180, dur: 0.15 }],
		// 12. Power up
		[{ freq: 200, delay: 0, dur: 0.4 }, { freq: 400, delay: 100, dur: 0.3 }, { freq: 600, delay: 200, dur: 0.25 }, { freq: 800, delay: 300, dur: 0.35 }],
		// 13. Bell chime
		[{ freq: 1397, delay: 0, dur: 0.3 }, { freq: 1047, delay: 150, dur: 0.3 }, { freq: 1397, delay: 300, dur: 0.4 }],
		// 14. Quick celebration
		[{ freq: 698, delay: 0, dur: 0.08 }, { freq: 880, delay: 60, dur: 0.08 }, { freq: 1047, delay: 120, dur: 0.2 }],
		// 15. Jazzy win
		[{ freq: 466, delay: 0, dur: 0.15 }, { freq: 587, delay: 120, dur: 0.15 }, { freq: 698, delay: 240, dur: 0.15 }, { freq: 932, delay: 360, dur: 0.3 }],
		// 16. Ding dong
		[{ freq: 1319, delay: 0, dur: 0.25 }, { freq: 988, delay: 200, dur: 0.35 }],
		// 17. Firework pop
		[{ freq: 500, delay: 0, dur: 0.05 }, { freq: 1500, delay: 30, dur: 0.1 }, { freq: 1200, delay: 100, dur: 0.08 }, { freq: 1800, delay: 150, dur: 0.15 }],
		// 18. Whimsical twinkle
		[{ freq: 1568, delay: 0, dur: 0.1 }, { freq: 1319, delay: 80, dur: 0.1 }, { freq: 1568, delay: 160, dur: 0.1 }, { freq: 1976, delay: 260, dur: 0.2 }],
		// 19. Heroic brass
		[{ freq: 349, delay: 0, dur: 0.2 }, { freq: 440, delay: 180, dur: 0.2 }, { freq: 523, delay: 360, dur: 0.2 }, { freq: 698, delay: 540, dur: 0.4 }],
		// 20. Magic spell
		[{ freq: 880, delay: 0, dur: 0.15 }, { freq: 1047, delay: 100, dur: 0.1 }, { freq: 784, delay: 180, dur: 0.1 }, { freq: 1175, delay: 280, dur: 0.3 }],
	];

	// 20 Scary/death sound patterns
	const SCARY_SOUNDS = [
		// 1. Classic scream descent
		{ type: 'scream', startFreq: 600, endFreq: 100, duration: 0.8, vibrato: true },
		// 2. Doom bell
		{ type: 'bell', freq: 80, duration: 1.2, decay: true },
		// 3. Evil laugh frequency
		{ type: 'laugh', freqs: [300, 250, 300, 200, 300, 150], duration: 0.12 },
		// 4. Thunder rumble
		{ type: 'noise', duration: 0.8, filterFreq: 150 },
		// 5. Ghost wail
		{ type: 'wail', startFreq: 400, endFreq: 800, duration: 1.0, wavey: true },
		// 6. Demonic growl
		{ type: 'growl', freq: 60, duration: 0.9 },
		// 7. Crypt door creak
		{ type: 'creak', startFreq: 200, endFreq: 400, duration: 0.6 },
		// 8. Witch cackle
		{ type: 'cackle', freqs: [500, 450, 550, 400, 600, 350], duration: 0.08 },
		// 9. Haunted whisper
		{ type: 'whisper', freq: 1200, duration: 0.7 },
		// 10. Skull rattle
		{ type: 'rattle', freq: 100, duration: 0.5, pulses: 8 },
		// 11. Banshee shriek
		{ type: 'shriek', startFreq: 800, endFreq: 2000, duration: 0.6 },
		// 12. Grave dirt thud
		{ type: 'thud', freq: 50, duration: 0.4 },
		// 13. Zombie moan
		{ type: 'moan', startFreq: 150, endFreq: 100, duration: 1.0, wobble: true },
		// 14. Chains rattling
		{ type: 'chains', freq: 300, duration: 0.6, rapid: true },
		// 15. Vampire hiss
		{ type: 'hiss', duration: 0.5 },
		// 16. Coffin slam
		{ type: 'slam', freq: 80, duration: 0.3 },
		// 17. Eerie wind
		{ type: 'wind', duration: 1.0 },
		// 18. Monster roar
		{ type: 'roar', startFreq: 200, endFreq: 80, duration: 0.7 },
		// 19. Dark portal
		{ type: 'portal', startFreq: 100, endFreq: 50, duration: 1.0 },
		// 20. Death knell
		{ type: 'knell', freqs: [130, 98, 130, 98], duration: 0.4 },
	];

	function playFunSound(pattern: typeof FUN_SOUNDS[0]) {
		pattern.forEach(({ freq, delay, dur }) => {
			setTimeout(() => {
				const osc = audioContext!.createOscillator();
				const gain = audioContext!.createGain();
				osc.connect(gain);
				gain.connect(audioContext!.destination);
				osc.type = 'triangle';
				osc.frequency.setValueAtTime(freq, audioContext!.currentTime);
				gain.gain.setValueAtTime(0.12, audioContext!.currentTime);
				gain.gain.exponentialRampToValueAtTime(0.01, audioContext!.currentTime + dur);
				osc.start(audioContext!.currentTime);
				osc.stop(audioContext!.currentTime + dur);
			}, delay);
		});
	}

	function playScarySound(sound: typeof SCARY_SOUNDS[0]) {
		const ctx = audioContext!;
		const now = ctx.currentTime;

		switch (sound.type) {
			case 'scream': {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.type = 'sawtooth';
				osc.frequency.setValueAtTime(sound.startFreq, now);
				osc.frequency.exponentialRampToValueAtTime(sound.endFreq, now + sound.duration);
				gain.gain.setValueAtTime(0.2, now);
				gain.gain.exponentialRampToValueAtTime(0.01, now + sound.duration);
				if (sound.vibrato) {
					const lfo = ctx.createOscillator();
					const lfoGain = ctx.createGain();
					lfo.frequency.value = 20;
					lfoGain.gain.value = 50;
					lfo.connect(lfoGain);
					lfoGain.connect(osc.frequency);
					lfo.start(now);
					lfo.stop(now + sound.duration);
				}
				osc.start(now);
				osc.stop(now + sound.duration);
				break;
			}
			case 'bell': {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.type = 'sine';
				osc.frequency.setValueAtTime(sound.freq, now);
				gain.gain.setValueAtTime(0.3, now);
				gain.gain.exponentialRampToValueAtTime(0.01, now + sound.duration);
				osc.start(now);
				osc.stop(now + sound.duration);
				break;
			}
			case 'laugh':
			case 'cackle': {
				sound.freqs.forEach((freq: number, i: number) => {
					setTimeout(() => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.connect(gain);
						gain.connect(ctx.destination);
						osc.type = 'sawtooth';
						osc.frequency.setValueAtTime(freq, ctx.currentTime);
						gain.gain.setValueAtTime(0.15, ctx.currentTime);
						gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + sound.duration);
						osc.start(ctx.currentTime);
						osc.stop(ctx.currentTime + sound.duration);
					}, i * sound.duration * 1000);
				});
				break;
			}
			case 'noise': {
				const bufferSize = ctx.sampleRate * sound.duration;
				const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
				const data = buffer.getChannelData(0);
				for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
				const noise = ctx.createBufferSource();
				const filter = ctx.createBiquadFilter();
				const gain = ctx.createGain();
				noise.buffer = buffer;
				filter.type = 'lowpass';
				filter.frequency.value = sound.filterFreq;
				noise.connect(filter);
				filter.connect(gain);
				gain.connect(ctx.destination);
				gain.gain.setValueAtTime(0.3, now);
				gain.gain.exponentialRampToValueAtTime(0.01, now + sound.duration);
				noise.start(now);
				break;
			}
			case 'wail': {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.type = 'sine';
				osc.frequency.setValueAtTime(sound.startFreq, now);
				osc.frequency.linearRampToValueAtTime(sound.endFreq, now + sound.duration / 2);
				osc.frequency.linearRampToValueAtTime(sound.startFreq, now + sound.duration);
				gain.gain.setValueAtTime(0.15, now);
				gain.gain.exponentialRampToValueAtTime(0.01, now + sound.duration);
				osc.start(now);
				osc.stop(now + sound.duration);
				break;
			}
			case 'growl': {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.type = 'sawtooth';
				osc.frequency.setValueAtTime(sound.freq, now);
				gain.gain.setValueAtTime(0.25, now);
				gain.gain.exponentialRampToValueAtTime(0.01, now + sound.duration);
				const lfo = ctx.createOscillator();
				const lfoGain = ctx.createGain();
				lfo.frequency.value = 8;
				lfoGain.gain.value = 20;
				lfo.connect(lfoGain);
				lfoGain.connect(osc.frequency);
				lfo.start(now);
				lfo.stop(now + sound.duration);
				osc.start(now);
				osc.stop(now + sound.duration);
				break;
			}
			case 'creak': {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.type = 'square';
				osc.frequency.setValueAtTime(sound.startFreq, now);
				osc.frequency.exponentialRampToValueAtTime(sound.endFreq, now + sound.duration);
				gain.gain.setValueAtTime(0.08, now);
				gain.gain.exponentialRampToValueAtTime(0.01, now + sound.duration);
				osc.start(now);
				osc.stop(now + sound.duration);
				break;
			}
			case 'whisper': {
				const bufferSize = ctx.sampleRate * sound.duration;
				const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
				const data = buffer.getChannelData(0);
				for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
				const noise = ctx.createBufferSource();
				const filter = ctx.createBiquadFilter();
				const gain = ctx.createGain();
				noise.buffer = buffer;
				filter.type = 'bandpass';
				filter.frequency.value = sound.freq;
				filter.Q.value = 10;
				noise.connect(filter);
				filter.connect(gain);
				gain.connect(ctx.destination);
				gain.gain.setValueAtTime(0.15, now);
				gain.gain.exponentialRampToValueAtTime(0.01, now + sound.duration);
				noise.start(now);
				break;
			}
			case 'rattle': {
				for (let i = 0; i < sound.pulses; i++) {
					setTimeout(() => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.connect(gain);
						gain.connect(ctx.destination);
						osc.type = 'square';
						osc.frequency.setValueAtTime(sound.freq + Math.random() * 50, ctx.currentTime);
						gain.gain.setValueAtTime(0.1, ctx.currentTime);
						gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
						osc.start(ctx.currentTime);
						osc.stop(ctx.currentTime + 0.05);
					}, i * (sound.duration * 1000 / sound.pulses));
				}
				break;
			}
			case 'shriek': {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.type = 'sawtooth';
				osc.frequency.setValueAtTime(sound.startFreq, now);
				osc.frequency.exponentialRampToValueAtTime(sound.endFreq, now + sound.duration);
				gain.gain.setValueAtTime(0.15, now);
				gain.gain.exponentialRampToValueAtTime(0.01, now + sound.duration);
				osc.start(now);
				osc.stop(now + sound.duration);
				break;
			}
			case 'thud':
			case 'slam': {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.type = 'sine';
				osc.frequency.setValueAtTime(sound.freq, now);
				osc.frequency.exponentialRampToValueAtTime(20, now + sound.duration);
				gain.gain.setValueAtTime(0.4, now);
				gain.gain.exponentialRampToValueAtTime(0.01, now + sound.duration);
				osc.start(now);
				osc.stop(now + sound.duration);
				break;
			}
			case 'moan': {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.type = 'sawtooth';
				osc.frequency.setValueAtTime(sound.startFreq, now);
				osc.frequency.linearRampToValueAtTime(sound.endFreq, now + sound.duration);
				gain.gain.setValueAtTime(0.15, now);
				gain.gain.exponentialRampToValueAtTime(0.01, now + sound.duration);
				if (sound.wobble) {
					const lfo = ctx.createOscillator();
					const lfoGain = ctx.createGain();
					lfo.frequency.value = 5;
					lfoGain.gain.value = 15;
					lfo.connect(lfoGain);
					lfoGain.connect(osc.frequency);
					lfo.start(now);
					lfo.stop(now + sound.duration);
				}
				osc.start(now);
				osc.stop(now + sound.duration);
				break;
			}
			case 'chains': {
				for (let i = 0; i < 12; i++) {
					setTimeout(() => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.connect(gain);
						gain.connect(ctx.destination);
						osc.type = 'triangle';
						osc.frequency.setValueAtTime(sound.freq + Math.random() * 200, ctx.currentTime);
						gain.gain.setValueAtTime(0.08, ctx.currentTime);
						gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
						osc.start(ctx.currentTime);
						osc.stop(ctx.currentTime + 0.04);
					}, i * 50);
				}
				break;
			}
			case 'hiss': {
				const bufferSize = ctx.sampleRate * sound.duration;
				const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
				const data = buffer.getChannelData(0);
				for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
				const noise = ctx.createBufferSource();
				const filter = ctx.createBiquadFilter();
				const gain = ctx.createGain();
				noise.buffer = buffer;
				filter.type = 'highpass';
				filter.frequency.value = 3000;
				noise.connect(filter);
				filter.connect(gain);
				gain.connect(ctx.destination);
				gain.gain.setValueAtTime(0.2, now);
				gain.gain.exponentialRampToValueAtTime(0.01, now + sound.duration);
				noise.start(now);
				break;
			}
			case 'wind': {
				const bufferSize = ctx.sampleRate * sound.duration;
				const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
				const data = buffer.getChannelData(0);
				for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
				const noise = ctx.createBufferSource();
				const filter = ctx.createBiquadFilter();
				const gain = ctx.createGain();
				noise.buffer = buffer;
				filter.type = 'bandpass';
				filter.frequency.value = 400;
				filter.Q.value = 2;
				noise.connect(filter);
				filter.connect(gain);
				gain.connect(ctx.destination);
				gain.gain.setValueAtTime(0.1, now);
				gain.gain.linearRampToValueAtTime(0.2, now + sound.duration / 2);
				gain.gain.linearRampToValueAtTime(0.01, now + sound.duration);
				noise.start(now);
				break;
			}
			case 'roar':
			case 'portal': {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.type = 'sawtooth';
				osc.frequency.setValueAtTime(sound.startFreq, now);
				osc.frequency.exponentialRampToValueAtTime(sound.endFreq, now + sound.duration);
				gain.gain.setValueAtTime(0.25, now);
				gain.gain.exponentialRampToValueAtTime(0.01, now + sound.duration);
				osc.start(now);
				osc.stop(now + sound.duration);
				break;
			}
			case 'knell': {
				sound.freqs.forEach((freq: number, i: number) => {
					setTimeout(() => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.connect(gain);
						gain.connect(ctx.destination);
						osc.type = 'sine';
						osc.frequency.setValueAtTime(freq, ctx.currentTime);
						gain.gain.setValueAtTime(0.2, ctx.currentTime);
						gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + sound.duration);
						osc.start(ctx.currentTime);
						osc.stop(ctx.currentTime + sound.duration);
					}, i * sound.duration * 1000);
				});
				break;
			}
		}
	}

	function playSelectionSound() {
		if (!soundEnabled) return;
		try {
			initAudio();

			if (darkMode) {
				// Pick random scary sound
				const soundIndex = Math.floor(secureRandom() * SCARY_SOUNDS.length);
				playScarySound(SCARY_SOUNDS[soundIndex]);
			} else {
				// Pick random fun sound
				const soundIndex = Math.floor(secureRandom() * FUN_SOUNDS.length);
				playFunSound(FUN_SOUNDS[soundIndex]);
			}
		} catch (e) {
			console.log('Audio not supported');
		}
	}

	function playTickSound() {
		if (!soundEnabled) return;
		try {
			initAudio();
			const oscillator = audioContext!.createOscillator();
			const gainNode = audioContext.createGain();
			oscillator.connect(gainNode);
			gainNode.connect(audioContext.destination);
			oscillator.frequency.setValueAtTime(darkMode ? 200 : 800, audioContext.currentTime);
			oscillator.type = darkMode ? 'sawtooth' : 'sine';
			gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
			gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
			oscillator.start(audioContext.currentTime);
			oscillator.stop(audioContext.currentTime + 0.05);
		} catch (e) {
			// Ignore audio errors
		}
	}

	let lastTickIndex = -1;

	function startIdleAnimation() {
		if (!idleSpinEnabled || idleAnimationId) return;

		let lastTime = performance.now();
		const idleSpeed = 0.0003;

		function animate(currentTime: number) {
			if (isSpinning || !idleSpinEnabled) {
				idleAnimationId = null;
				return;
			}

			const delta = currentTime - lastTime;
			lastTime = currentTime;
			currentRotation += idleSpeed * delta;

			const ctx = canvas?.getContext('2d');
			if (ctx) {
				ctx.save();
				ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
				drawWheel(ctx, currentRotation);
				ctx.restore();
			}

			idleAnimationId = requestAnimationFrame(animate);
		}

		idleAnimationId = requestAnimationFrame(animate);
	}

	function stopIdleAnimation() {
		if (idleAnimationId) {
			cancelAnimationFrame(idleAnimationId);
			idleAnimationId = null;
		}
	}

	function getActiveParticipants(): Participant[] {
		return participants.filter((p) => p.active);
	}

	function setupCanvas() {
		dpr = window.devicePixelRatio || 1;
		canvas.width = actualSize * dpr;
		canvas.height = actualSize * dpr;
		canvas.style.width = actualSize + 'px';
		canvas.style.height = actualSize + 'px';

		const ctx = canvas.getContext('2d');
		if (ctx) {
			ctx.scale(dpr, dpr);
		}
	}

	function drawWheel(ctx: CanvasRenderingContext2D, rotation: number) {
		const active = getActiveParticipants();
		const center = actualSize / 2;
		const radius = actualSize / 2 - 30;

		ctx.clearRect(0, 0, actualSize, actualSize);

		if (darkMode) {
			// Gothic outer border (no shadow for performance)
			ctx.beginPath();
			ctx.arc(center, center, radius + 15, 0, 2 * Math.PI);
			ctx.strokeStyle = '#4a0e0e';
			ctx.lineWidth = 8;
			ctx.stroke();

			// Inner decorative ring
			ctx.beginPath();
			ctx.arc(center, center, radius + 8, 0, 2 * Math.PI);
			ctx.strokeStyle = '#8B0000';
			ctx.lineWidth = 2;
			ctx.stroke();
		} else {
			// Simple border for light mode
			ctx.beginPath();
			ctx.arc(center, center, radius + 10, 0, 2 * Math.PI);
			ctx.strokeStyle = '#e5e7eb';
			ctx.lineWidth = 6;
			ctx.stroke();
		}

		if (active.length === 0) {
			ctx.fillStyle = darkMode ? '#666' : '#9ca3af';
			ctx.font = darkMode ? "bold 20px 'Creepster', cursive" : "bold 18px system-ui, sans-serif";
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(darkMode ? 'Add souls...' : 'Add participants', center, center);
			return;
		}

		ctx.save();
		ctx.translate(center, center);
		ctx.rotate(rotation);

		const sliceAngle = (2 * Math.PI) / active.length;
		const fontSize = Math.max(12, actualSize * 0.045);

		active.forEach((participant, i) => {
			const startAngle = i * sliceAngle - Math.PI / 2;
			const endAngle = startAngle + sliceAngle;
			const midAngle = startAngle + sliceAngle / 2;

			// Draw slice with gradient
			const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
			const baseColor = participant.color || getSliceColor(i, darkMode, colorScheme);
			if (darkMode) {
				gradient.addColorStop(0, '#1a1a2e');
				gradient.addColorStop(0.3, baseColor);
				gradient.addColorStop(1, baseColor);
			} else {
				gradient.addColorStop(0, '#ffffff');
				gradient.addColorStop(0.2, baseColor);
				gradient.addColorStop(1, baseColor);
			}

			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.arc(0, 0, radius, startAngle, endAngle);
			ctx.closePath();
			ctx.fillStyle = gradient;
			ctx.fill();

			// Slice border
			ctx.strokeStyle = darkMode ? 'rgba(139, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.3)';
			ctx.lineWidth = 2;
			ctx.stroke();

			// Draw text
			ctx.save();
			ctx.rotate(midAngle);

			// Simple text shadow for readability
			ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
			ctx.shadowBlur = 2;
			ctx.shadowOffsetX = 1;
			ctx.shadowOffsetY = 1;
			ctx.fillStyle = '#fff';
			ctx.font = darkMode ? `${fontSize}px 'Creepster', cursive` : `bold ${fontSize}px system-ui, sans-serif`;
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'center';

			const text = participant.name.length > 12
				? participant.name.substring(0, 12) + '..'
				: participant.name;

			// Position text in the middle of the slice
			const textRadius = radius * 0.65;
			ctx.fillText(text, textRadius, 0);
			ctx.restore();
		});

		ctx.restore();

		// Draw center circle (responsive)
		const centerCircleRadius = Math.max(15, actualSize * 0.08);

		if (darkMode) {
			// Center circle
			ctx.beginPath();
			ctx.arc(center, center, centerCircleRadius, 0, 2 * Math.PI);
			ctx.fillStyle = '#0d0d0d';
			ctx.fill();

			// Border rings
			ctx.beginPath();
			ctx.arc(center, center, centerCircleRadius, 0, 2 * Math.PI);
			ctx.strokeStyle = '#8B0000';
			ctx.lineWidth = Math.max(2, actualSize * 0.006);
			ctx.stroke();

			ctx.beginPath();
			ctx.arc(center, center, centerCircleRadius * 0.85, 0, 2 * Math.PI);
			ctx.strokeStyle = '#4a0e0e';
			ctx.lineWidth = Math.max(1, actualSize * 0.003);
			ctx.stroke();

			// Draw skull emoji (responsive)
			ctx.font = `${Math.max(20, actualSize * 0.1)}px system-ui, sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('💀', center, center);
		} else {
			// Simple center for light mode
			ctx.beginPath();
			ctx.arc(center, center, centerCircleRadius, 0, 2 * Math.PI);
			ctx.fillStyle = '#1e1b4b';
			ctx.fill();
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = Math.max(2, actualSize * 0.004);
			ctx.stroke();
		}

		// Draw pointer (scythe/dagger shape)
		drawPointer(ctx, rotation);
	}

	function drawPointer(ctx: CanvasRenderingContext2D, rotation: number) {
		const active = getActiveParticipants();
		const center = actualSize / 2;
		const pointerSize = Math.max(15, actualSize * 0.07);

		let pointerColor = darkMode ? '#8B0000' : '#10b981';
		if (active.length > 0) {
			const sliceAngle = (2 * Math.PI) / active.length;
			const normalizedRotation = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
			const angleAtPointer = (Math.PI / 2 - normalizedRotation + 2 * Math.PI) % (2 * Math.PI);
			const colorIndex = Math.floor(angleAtPointer / sliceAngle) % active.length;
			const currentParticipant = active[colorIndex];
			pointerColor = currentParticipant?.color || getSliceColor(colorIndex, darkMode, colorScheme);
		}

		ctx.save();
		ctx.translate(actualSize - 10, center);

		if (darkMode) {
			// Dagger/blade shape
			ctx.beginPath();
			ctx.moveTo(10, -pointerSize * 0.8);
			ctx.lineTo(-pointerSize * 2.5, 0);
			ctx.lineTo(10, pointerSize * 0.8);
			ctx.lineTo(5, 0);
			ctx.closePath();
		} else {
			// Simple triangle for light mode
			ctx.beginPath();
			ctx.moveTo(0, -pointerSize);
			ctx.lineTo(-pointerSize * 2, 0);
			ctx.lineTo(0, pointerSize);
			ctx.closePath();
		}

		ctx.fillStyle = pointerColor;
		ctx.fill();
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = Math.max(1, actualSize * 0.003);
		ctx.stroke();

		ctx.restore();
	}

	function spin() {
		const active = getActiveParticipants();
		if (active.length === 0 || isSpinning) return;

		stopIdleAnimation();
		isSpinning = true;
		onSpinStart();
		playSpinSound();

		const spins = 4 + secureRandom() * 3;
		const extraAngle = secureRandom() * 2 * Math.PI;
		const targetRotation = currentRotation + spins * 2 * Math.PI + extraAngle;
		// Fast mode spins 3x faster
		const duration = fastMode ? (1500 + secureRandom() * 500) : (5000 + secureRandom() * 2000);
		const startTime = performance.now();
		const startRotation = currentRotation;

		function easeOutCubic(t: number): number {
			return 1 - Math.pow(1 - t, 3);
		}

		function animate(currentTime: number) {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const easedProgress = easeOutCubic(progress);

			currentRotation = startRotation + (targetRotation - startRotation) * easedProgress;

			// Play tick sound when passing a segment
			const sliceAngle = (2 * Math.PI) / active.length;
			const normalizedRotation = ((currentRotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
			const angleAtPointer = (Math.PI / 2 - normalizedRotation + 2 * Math.PI) % (2 * Math.PI);
			const currentTickIndex = Math.floor(angleAtPointer / sliceAngle);
			if (currentTickIndex !== lastTickIndex) {
				lastTickIndex = currentTickIndex;
				playTickSound();
			}

			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.save();
				ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
				drawWheel(ctx, currentRotation);
				ctx.restore();
			}

			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				isSpinning = false;
				lastTickIndex = -1; // Reset for next spin
				const winningIndex = Math.floor(angleAtPointer / sliceAngle) % active.length;
				const winner = active[winningIndex];
				playSelectionSound();
				onSpinComplete(winner);
				setTimeout(() => startIdleAnimation(), 100);
			}
		}

		requestAnimationFrame(animate);
	}

	function handleCanvasClick() {
		// Initialize audio on first tap (required for mobile)
		initAudio();
		spin();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.code === 'Space' && !isSpinning) {
			e.preventDefault();
			spin();
		}
	}

	function handleMouseEnter() {
		isHovering = true;
		onHover?.(true);
	}

	function handleMouseLeave() {
		isHovering = false;
		onHover?.(false);
	}

	// Touch/swipe support for mobile
	let touchStartX = 0;
	let touchStartY = 0;
	let touchStartTime = 0;
	let touchStartedInCenter = false;

	function isTouchInCenter(clientX: number, clientY: number): boolean {
		if (!canvas) return false;
		const rect = canvas.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		const touchDistFromCenter = Math.sqrt(
			Math.pow(clientX - centerX, 2) + Math.pow(clientY - centerY, 2)
		);
		// Only trigger if touch is within 70% of wheel radius
		const maxRadius = (rect.width / 2) * 0.7;
		return touchDistFromCenter <= maxRadius;
	}

	function handleTouchStart(e: TouchEvent) {
		if (e.touches.length === 1) {
			touchStartX = e.touches[0].clientX;
			touchStartY = e.touches[0].clientY;
			touchStartTime = Date.now();
			touchStartedInCenter = isTouchInCenter(touchStartX, touchStartY);
			initAudio(); // Initialize audio on touch
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		if (e.changedTouches.length === 1 && touchStartedInCenter) {
			const touchEndX = e.changedTouches[0].clientX;
			const touchEndY = e.changedTouches[0].clientY;
			const touchEndTime = Date.now();

			const deltaX = touchEndX - touchStartX;
			const deltaY = touchEndY - touchStartY;
			const deltaTime = touchEndTime - touchStartTime;

			// Calculate distance and velocity
			const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
			const velocity = distance / deltaTime;

			// Spin if it's a swipe (fast enough and far enough) or a tap
			const isSwipe = distance > 30 && velocity > 0.3;
			const isTap = distance < 10 && deltaTime < 300;

			if ((isSwipe || isTap) && !isSpinning) {
				spin();
			}
		}
		touchStartedInCenter = false;
	}

	onMount(() => {
		setupCanvas();
		const ctx = canvas.getContext('2d');
		if (ctx) {
			drawWheel(ctx, currentRotation);
		}
		startIdleAnimation();

		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
			stopIdleAnimation();
		};
	});

	$effect(() => {
		participants;
	});

	$effect(() => {
		// Stop idle animation when disabled
		if (!idleSpinEnabled && idleAnimationId) {
			stopIdleAnimation();
		}
		// Start idle animation when enabled and not spinning
		else if (idleSpinEnabled && !idleAnimationId && !isSpinning) {
			startIdleAnimation();
		}
	});
</script>

<div class="flex flex-col items-center relative">
	<canvas
		bind:this={canvas}
		onclick={handleCanvasClick}
		ontouchstart={handleTouchStart}
		ontouchend={handleTouchEnd}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
		class="cursor-pointer transition-transform hover:scale-[1.02]"
	></canvas>
</div>
