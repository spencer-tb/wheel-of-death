import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { WheelConfig } from '$lib/types';

const TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.WHEELS) {
		return json({ error: 'KV not available' }, { status: 500 });
	}

	const { id } = params;

	// Validate ID format
	if (!id || !/^[a-zA-Z0-9]{8}$/.test(id)) {
		return json({ error: 'Invalid wheel ID' }, { status: 400 });
	}

	const data = await platform.env.WHEELS.get(id);

	if (!data) {
		return json({ error: 'Wheel not found' }, { status: 404 });
	}

	let config: WheelConfig;
	try {
		config = JSON.parse(data);
	} catch {
		return json({ error: 'Corrupted wheel data' }, { status: 500 });
	}

	// Update lastAccessedAt and refresh TTL
	config.lastAccessedAt = Date.now();
	await platform.env.WHEELS.put(id, JSON.stringify(config), {
		expirationTtl: TTL_SECONDS
	});

	return json({ config });
};

// DELETE removed - wheels expire naturally after 60 days
// If needed, could add auth token stored with wheel for delete permission
