import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { WheelConfig } from '$lib/types';

const TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

export const load: PageServerLoad = async ({ url, platform }) => {
	const id = url.searchParams.get('id');

	// No ID provided - return empty config (fresh wheel)
	if (!id) {
		return { config: null };
	}

	// Validate ID format - redirect to root if invalid
	if (!/^[a-zA-Z0-9]{8}$/.test(id)) {
		throw redirect(302, '/');
	}

	if (!platform?.env?.WHEELS) {
		return { config: null };
	}

	const data = await platform.env.WHEELS.get(id);

	// Wheel not found or expired - redirect to root
	if (!data) {
		throw redirect(302, '/');
	}

	let config: WheelConfig;
	try {
		config = JSON.parse(data);
	} catch {
		// Corrupted data - redirect to root
		throw redirect(302, '/');
	}

	// Update lastAccessedAt and refresh TTL (keeps wheel alive for another 60 days)
	config.lastAccessedAt = Date.now();
	await platform.env.WHEELS.put(id, JSON.stringify(config), {
		expirationTtl: TTL_SECONDS
	});

	return { config };
};
