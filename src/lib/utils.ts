// Cryptographically secure random number generator
export function secureRandom(): number {
	const array = new Uint32Array(1);
	crypto.getRandomValues(array);
	return array[0] / (0xFFFFFFFF + 1);
}

export function generateId(length: number = 8): string {
	const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(secureRandom() * chars.length));
	}
	return result;
}

export function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Color schemes for light mode
export const COLOR_SCHEMES = {
	default: [
		'#FF6B6B', // coral red
		'#4ECDC4', // teal
		'#45B7D1', // sky blue
		'#96E6A1', // mint green
		'#DDA0DD', // plum
		'#F7DC6F', // yellow
		'#BB8FCE', // purple
		'#85C1E9', // light blue
		'#F8B739', // orange
		'#2ECC71', // emerald
		'#E74C3C', // red
		'#3498DB', // blue
	],
	rainbow: [
		'#ef4444', // red
		'#f97316', // orange
		'#eab308', // yellow
		'#22c55e', // green
		'#06b6d4', // cyan
		'#3b82f6', // blue
		'#8b5cf6', // violet
		'#d946ef', // magenta
		'#f43f5e', // rose
		'#14b8a6', // teal
		'#a3e635', // lime
		'#fbbf24', // amber
	],
	pastel: [
		'#fda4af', // pink
		'#fdba74', // peach
		'#fde047', // yellow
		'#bef264', // lime
		'#86efac', // green
		'#5eead4', // teal
		'#7dd3fc', // sky
		'#a5b4fc', // indigo
		'#c4b5fd', // violet
		'#f0abfc', // fuchsia
		'#fca5a5', // red
		'#a5f3fc', // cyan
	],
	ocean: [
		'#0ea5e9', // sky
		'#06b6d4', // cyan
		'#14b8a6', // teal
		'#0891b2', // dark cyan
		'#0284c7', // light blue
		'#0369a1', // blue
		'#1d4ed8', // indigo blue
		'#2563eb', // blue
		'#3b82f6', // blue
		'#0e7490', // dark teal
		'#155e75', // darker teal
		'#164e63', // deep teal
	],
	sunset: [
		'#f97316', // orange
		'#fb923c', // light orange
		'#f43f5e', // rose
		'#ec4899', // pink
		'#e11d48', // red
		'#dc2626', // red
		'#f59e0b', // amber
		'#fbbf24', // yellow
		'#d946ef', // fuchsia
		'#c026d3', // purple
		'#be185d', // pink
		'#ea580c', // dark orange
	],
};

// Death-themed color palette for wheel slices (dark mode)
export const DARK_SLICE_COLORS = [
	'#8B0000', // dark red / blood
	'#4A0E4E', // dark purple
	'#1a1a2e', // midnight
	'#6B0F1A', // crimson
	'#2D132C', // dark magenta
	'#4B0082', // indigo
	'#800020', // burgundy
	'#3D0C02', // dark brown/blood
	'#1B1B3A', // dark navy
	'#5C0A0A', // wine
	'#2E0219', // dark plum
	'#0D0D0D', // near black
];

export function getSliceColor(index: number, darkMode: boolean = true, colorScheme: keyof typeof COLOR_SCHEMES = 'default'): string {
	if (darkMode) {
		return DARK_SLICE_COLORS[index % DARK_SLICE_COLORS.length];
	}
	const colors = COLOR_SCHEMES[colorScheme];
	return colors[index % colors.length];
}

// Light mode phrases
const LIGHT_PHRASES = [
	"The winner is...",
	"You're up:",
	"Time to shine:",
	"The spotlight is on:",
	"Next up:",
	"Let's hear from:",
	"Your turn:",
	"The wheel has chosen:",
	"Congratulations:",
	"Front and center:",
];

// Death-themed phrases for when someone is selected (dark mode)
const DARK_PHRASES = [
	"The victim is...",
	"Death comes for:",
	"RIP:",
	"The reaper claims:",
	"Marked for death:",
	"The grave awaits:",
	"Your soul belongs to:",
	"The darkness chooses:",
	"Doomed:",
	"The curse falls upon:",
	"No escape for:",
	"The spirits have chosen:",
	"Your fate is sealed:",
	"Into the void goes:",
	"The coffin awaits:",
	"Next to perish:",
	"The beyond calls:",
	"Summoned from the shadows:",
];

export function getRandomPhrase(darkMode: boolean = true): string {
	const phrases = darkMode ? DARK_PHRASES : LIGHT_PHRASES;
	return phrases[Math.floor(secureRandom() * phrases.length)];
}
