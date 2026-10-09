import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RepoStats } from '$lib/types';
import { STATS_KEY, buildStats } from '$lib/github-stats';
import { TEAM } from '$lib/team';

// The scheduled stats workflow keeps STATS_KEY fresh in KV. A GITHUB_TOKEN
// binding is only a fallback for running without the workflow.
const FALLBACK_CACHE_SECONDS = 60 * 60;

export const GET: RequestHandler = async ({ platform }) => {
	const kv = platform?.env?.WHEELS;
	const cached = await kv?.get(STATS_KEY);
	if (cached) {
		return json(JSON.parse(cached) as RepoStats, {
			headers: { 'Cache-Control': 'public, max-age=60' }
		});
	}

	const token = platform?.env?.GITHUB_TOKEN;
	if (!token) {
		return json({ error: 'Stats have not been published yet' }, { status: 503 });
	}
	try {
		const stats = await buildStats(token, TEAM.map((m) => m.github));
		await kv?.put(STATS_KEY, JSON.stringify(stats), { expirationTtl: FALLBACK_CACHE_SECONDS });
		return json(stats, { headers: { 'Cache-Control': 'public, max-age=60' } });
	} catch (e) {
		console.error('GitHub stats failed:', e);
		return json({ error: 'Could not reach GitHub' }, { status: 502 });
	}
};
