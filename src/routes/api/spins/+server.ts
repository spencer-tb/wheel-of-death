import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const SPIN_COUNT_KEY = 'global_spin_count';

export const GET: RequestHandler = async ({ platform }) => {
	if (!platform?.env?.WHEELS) {
		return json({ count: 0 });
	}

	const count = await platform.env.WHEELS.get(SPIN_COUNT_KEY);
	return json({ count: count ? parseInt(count, 10) : 0 });
};

export const POST: RequestHandler = async ({ platform }) => {
	if (!platform?.env?.WHEELS) {
		return json({ error: 'KV not available' }, { status: 500 });
	}

	// Get current count
	const currentCount = await platform.env.WHEELS.get(SPIN_COUNT_KEY);
	const newCount = (currentCount ? parseInt(currentCount, 10) : 0) + 1;

	// Store new count (no expiration - permanent)
	await platform.env.WHEELS.put(SPIN_COUNT_KEY, newCount.toString());

	return json({ count: newCount });
};
