export interface Participant {
	id: string;
	name: string;
	active: boolean; // false = removed after being picked
	color?: string; // custom color for wheel slice
	image?: string; // small JPEG data URL drawn on the slice
}

export interface WheelConfig {
	id: string;
	participants: Participant[];
	timerDuration: number; // seconds
	timerEnabled: boolean;
	darkMode: boolean;
	fastMode: boolean;
	soundEnabled: boolean;
	idleSpinEnabled: boolean;
	avengersMode: boolean;
	colorScheme: 'default' | 'rainbow' | 'pastel' | 'ocean' | 'sunset';
	createdAt: number;
	lastAccessedAt: number;
}

export interface SpinResult {
	participant: Participant;
	angle: number;
}
