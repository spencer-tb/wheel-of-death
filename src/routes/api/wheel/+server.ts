import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { WheelConfig, Participant } from '$lib/types';
import { generateId } from '$lib/utils';

const TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days
const MAX_PARTICIPANTS = 50;
const MAX_NAME_LENGTH = 50;
const MIN_TIMER = 10;
const MAX_TIMER = 3600; // 1 hour

const VALID_COLOR_SCHEMES = ['default', 'rainbow', 'pastel', 'ocean', 'sunset'] as const;

function sanitizeParticipant(p: unknown): Participant | null {
	if (!p || typeof p !== 'object') return null;
	const obj = p as Record<string, unknown>;

	if (typeof obj.name !== 'string' || !obj.name.trim()) return null;
	const name = obj.name.trim().slice(0, MAX_NAME_LENGTH);

	return {
		id: typeof obj.id === 'string' ? obj.id.slice(0, 20) : generateId(8),
		name,
		active: typeof obj.active === 'boolean' ? obj.active : true,
		color: typeof obj.color === 'string' ? obj.color.slice(0, 20) : undefined
	};
}

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.WHEELS) {
		return json({ error: 'KV not available' }, { status: 500 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	if (!body || typeof body !== 'object') {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const data = body as Record<string, unknown>;

	// Validate and sanitize participants
	const rawParticipants = Array.isArray(data.participants) ? data.participants : [];
	const participants = rawParticipants
		.slice(0, MAX_PARTICIPANTS)
		.map(sanitizeParticipant)
		.filter((p): p is Participant => p !== null);

	// Validate timer duration
	let timerDuration = 120;
	if (typeof data.timerDuration === 'number') {
		timerDuration = Math.max(MIN_TIMER, Math.min(MAX_TIMER, Math.floor(data.timerDuration)));
	}

	// Generate or validate ID
	const wheelId = typeof data.id === 'string' && /^[a-zA-Z0-9]{8}$/.test(data.id)
		? data.id
		: generateId(8);

	// Validate boolean settings
	const timerEnabled = typeof data.timerEnabled === 'boolean' ? data.timerEnabled : true;
	const darkMode = typeof data.darkMode === 'boolean' ? data.darkMode : false;
	const fastMode = typeof data.fastMode === 'boolean' ? data.fastMode : false;
	const soundEnabled = typeof data.soundEnabled === 'boolean' ? data.soundEnabled : true;

	// Validate color scheme
	const colorScheme = typeof data.colorScheme === 'string' &&
		VALID_COLOR_SCHEMES.includes(data.colorScheme as typeof VALID_COLOR_SCHEMES[number])
		? (data.colorScheme as typeof VALID_COLOR_SCHEMES[number])
		: 'default';

	const now = Date.now();

	const config: WheelConfig = {
		id: wheelId,
		participants,
		timerDuration,
		timerEnabled,
		darkMode,
		fastMode,
		soundEnabled,
		colorScheme,
		createdAt: typeof data.createdAt === 'number' && data.id ? data.createdAt : now,
		lastAccessedAt: now
	};

	await platform.env.WHEELS.put(wheelId, JSON.stringify(config), {
		expirationTtl: TTL_SECONDS
	});

	return json({ id: wheelId, config });
};
