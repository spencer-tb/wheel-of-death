// Build the repo stats JSON that the stats workflow uploads to KV.
// Usage: GITHUB_TOKEN=... node --experimental-strip-types scripts/update-stats.ts out.json
import { writeFileSync } from 'node:fs';
import { buildStats } from '../src/lib/github-stats.ts';
import { TEAM } from '../src/lib/team.ts';

const token = process.env.GITHUB_TOKEN;
if (!token) {
	console.error('GITHUB_TOKEN is not set');
	process.exit(1);
}
const out = process.argv[2] ?? 'stats.json';
const stats = await buildStats(token, TEAM.map((m) => m.github));
writeFileSync(out, JSON.stringify(stats));
const eels = stats.eels;
console.log(
	`${out}: ${stats.repo} as of ${stats.fetchedAt}; ` +
		`${eels.week.mergedPRs} merged this week, top reviewer ${eels.reviewers[0]?.login ?? 'nobody'}; ` +
		stats.forks.map((f) => `${f.label} ${f.summary.eips} EIPs, ${f.summary.implemented} implemented, ${f.summary.checkedOff} checked off`).join('; ')
);
