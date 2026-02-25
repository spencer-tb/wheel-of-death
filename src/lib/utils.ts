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

// Fun icebreaker questions - light, non-stressful conversation starters
const ICEBREAKER_QUESTIONS = [
	"What did you have for breakfast today?",
	"What's the last thing you watched on TV?",
	"If you could only eat one food for a week, what would it be?",
	"What's your go-to comfort meal?",
	"Are you a morning person or a night owl?",
	"What song is stuck in your head right now?",
	"What's the best thing that happened to you this week?",
	"If you could teleport anywhere right now, where would you go?",
	"What's your most-used emoji?",
	"Tea or coffee?",
	"What's the last photo you took on your phone?",
	"If you had a theme song, what would it be?",
	"What's your guilty pleasure snack?",
	"What's the weirdest thing in your fridge right now?",
	"If you could have any superpower for a day, what would it be?",
	"What's your favorite way to spend a lazy Sunday?",
	"What's the last thing that made you laugh out loud?",
	"Pineapple on pizza: yes or no?",
	"What's your unpopular food opinion?",
	"If you were a pizza topping, which one would you be?",
	"What's the most random fact you know?",
	"What's the best Wi-Fi name you've ever seen?",
	"What did you want to be when you were a kid?",
	"What's your go-to karaoke song?",
	"If you could swap lives with anyone for a day, who would it be?",
	"What's the last thing you googled?",
	"What's a skill you'd love to learn?",
	"Window seat or aisle seat?",
	"What's the best advice you've ever received?",
	"If you could time travel, past or future?",
	"What's your favorite holiday?",
	"Do you have any hidden talents?",
	"What's the best meal you've ever had?",
	"If you could instantly learn any language, which one?",
	"What's the most adventurous thing you've ever done?",
	"Cats or dogs?",
	"What's on your bucket list?",
	"What's the last book you read?",
	"If you were a vegetable, what would you be and why?",
	"What's your favorite smell?",
];

const DARK_ICEBREAKER_QUESTIONS = [
	"What's the creepiest thing that ever happened to you?",
	"If you were a ghost, who would you haunt?",
	"What's the scariest movie you've ever seen?",
	"If you were a villain, what would your evil plan be?",
	"What's the weirdest nightmare you've ever had?",
	"If you could curse someone with a minor inconvenience, what would it be?",
	"Zombies or vampires: which apocalypse do you survive?",
	"What's the most haunted place you've visited?",
	"If you were a monster, what kind would you be?",
	"What's the last thing that gave you the chills?",
	"If you had to be trapped in a horror movie, which one?",
	"What's the spookiest thing in your search history?",
	"Would you rather fight 100 duck-sized zombies or 1 zombie-sized duck?",
	"If you were a ghost, where would you haunt and why?",
	"What's the most cursed food combo you've ever tried?",
	"What would your tombstone say?",
	"If you had to pick a last meal, what would it be?",
	"What's the worst way to go in a horror movie?",
	"If you could bring one fictional monster to life, which one?",
	"What's the scariest thing you've ever eaten?",
];

export function getRandomQuestion(darkMode: boolean = false): string {
	const questions = darkMode ? DARK_ICEBREAKER_QUESTIONS : ICEBREAKER_QUESTIONS;
	return questions[Math.floor(secureRandom() * questions.length)];
}
