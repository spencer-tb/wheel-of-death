import type {
	AuthorStat,
	DevnetPlanRow,
	EipPullRequest,
	EipRow,
	EipSection,
	EipStage,
	EipStatus,
	ForkActivation,
	ForkStage,
	ForkView,
	MergedPullRequest,
	ReleaseItem,
	ReleaseLink,
	RepoStats,
	ReviewerStat,
	StatsView,
	WeekPoint
} from './types';

// Stats for the spec repo. A scheduled GitHub Actions job builds these and
// writes them into KV; the endpoint only serves what it finds there.
const OWNER = 'ethereum';
const NAME = 'execution-specs';
export const STATS_KEY = 'github_stats_v4';
const WINDOW_DAYS = 7; // leaderboards
const CHART_WEEKS = 8; // rolling weekly chart
const MAX_PAGES = 10; // 100 pull requests per page
const LEADERBOARD_SIZE = 10;
const RECENT_MERGES = 5;
const DAY = 24 * 60 * 60 * 1000;

// The EELS tab covers every pull request; fork tabs are EIP trackers
interface ViewSpec {
	key: string;
	label: string;
	description: string;
	base: string | null; // null means the whole repo
	prefixes: string[];
}

const EELS_VIEW: ViewSpec = { key: 'eels', label: 'EELS', description: 'every pull request', base: null, prefixes: [] };

// A fork tracker: the meta EIP gives titles and inclusion stage, the EELS
// tracker issue gives the EL scope and checkbox tallies, the fork branch
// gives what is implemented and tested, and branches plus pull requests
// give the state of everything still in flight.
interface ForkSpec {
	key: string;
	label: string;
	position: string;
	metaEip: number | null;
	trackerIssue: number | null;
	assignmentsIssue: number | null; // per-EIP owners and tracker links
	branch: string | null;
	module: string | null;
	eipPrefix: string | null;
	placeholder: string | null;
	headliners: number[]; // candidate headliner EIPs for a fork with no meta EIP yet
	declinedFrom: number | null; // meta EIP whose declined EIPs roll forward to this fork
	releasePrefixes: string[]; // release tags that belong to this fork
}

const FORKS: ForkSpec[] = [
	{ key: 'glamsterdam', label: 'Glamsterdam', position: 'N', metaEip: 7773, trackerIssue: 3217, assignmentsIssue: null, branch: 'forks/amsterdam', module: 'amsterdam', eipPrefix: 'eips/amsterdam/', placeholder: null, headliners: [], declinedFrom: null, releasePrefixes: ['tests@', 'tests-glamsterdam-devnet@'] },
	{ key: 'hegota', label: 'Hegota', position: 'N+1', metaEip: 8081, trackerIssue: 3664, assignmentsIssue: 3685, branch: 'forks/bogota', module: 'bogota', eipPrefix: 'eips/bogota/', placeholder: null, headliners: [], declinedFrom: null, releasePrefixes: ['tests-hegota-devnet@', 'tests-frames-devnet@', 'tests-focil-devnet@'] },
	{
		key: 'istar',
		label: 'I*',
		position: 'N+2',
		metaEip: null,
		trackerIssue: null,
		assignmentsIssue: null,
		branch: null,
		module: null,
		eipPrefix: null,
		placeholder: 'No meta EIP or fork branch yet. Headliners get picked first, the rest of the scope follows.',
		// Multidimensional gas, binary trees, in-mempool proof aggregation
		headliners: [7999, 7864, 8288],
		declinedFrom: 8081,
		releasePrefixes: []
	}
];

// Every prototype branch across the fork prefixes that still exist
const PROTOTYPE_PREFIXES = ['eips/amsterdam/', 'eips/bogota/'];

const QUERY = `
query($prQuery: String!, $newIssueQuery: String!, $closedIssueQuery: String!, $after: String) {
	repository(owner: "${OWNER}", name: "${NAME}") {
		stargazerCount
		forkCount
		openPRs: pullRequests(states: OPEN) { totalCount }
		mergedPRs: pullRequests(states: MERGED) { totalCount }
		openIssues: issues(states: OPEN) { totalCount }
		closedIssues: issues(states: CLOSED) { totalCount }
	}
	newIssues: search(query: $newIssueQuery, type: ISSUE) { issueCount }
	closedIssuesInWindow: search(query: $closedIssueQuery, type: ISSUE) { issueCount }
	recent: search(query: $prQuery, type: ISSUE, first: 100, after: $after) {
		pageInfo { hasNextPage endCursor }
		nodes {
			... on PullRequest {
				number
				title
				url
				state
				isDraft
				baseRefName
				createdAt
				mergedAt
				closedAt
				author { __typename login avatarUrl }
				reviews(first: 50) {
					nodes {
						state
						submittedAt
						author { __typename login avatarUrl }
					}
				}
			}
		}
	}
}`;

interface GqlActor {
	__typename: string;
	login: string;
	avatarUrl: string;
}

interface GqlPullRequest {
	number: number;
	title: string;
	url: string;
	state: 'OPEN' | 'MERGED' | 'CLOSED';
	isDraft: boolean;
	baseRefName: string;
	createdAt: string;
	mergedAt: string | null;
	closedAt: string | null;
	author: GqlActor | null;
	reviews: { nodes: { state: string; submittedAt: string | null; author: GqlActor | null }[] };
}

interface GqlPage {
	repository: {
		stargazerCount: number;
		forkCount: number;
		openPRs: { totalCount: number };
		mergedPRs: { totalCount: number };
		openIssues: { totalCount: number };
		closedIssues: { totalCount: number };
	};
	newIssues: { issueCount: number };
	closedIssuesInWindow: { issueCount: number };
	recent: {
		pageInfo: { hasNextPage: boolean; endCursor: string | null };
		nodes: GqlPullRequest[];
	};
}

function isHuman(actor: GqlActor | null): actor is GqlActor {
	return !!actor && actor.__typename === 'User';
}

async function fetchPage(token: string, variables: Record<string, string | null>): Promise<GqlPage> {
	const res = await fetch('https://api.github.com/graphql', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			'User-Agent': 'wheelofdeath.rip'
		},
		body: JSON.stringify({ query: QUERY, variables })
	});
	if (!res.ok) {
		throw new Error(`GitHub responded ${res.status}`);
	}
	const body = (await res.json()) as { data?: GqlPage; errors?: { message: string }[] };
	if (!body.data) {
		throw new Error(body.errors?.map((e) => e.message).join('; ') || 'Empty GraphQL response');
	}
	return body.data;
}

function inView(spec: ViewSpec, base: string): boolean {
	return spec.base === null || spec.prefixes.some((p) => base === p || base.startsWith(p));
}

// Build one tab from the pull requests that belong to it. Leaderboards cover
// only `team`, everyone listed even with nothing this week.
function buildView(
	spec: ViewSpec,
	pulls: GqlPullRequest[],
	team: string[],
	now: Date,
	since: string,
	totals: { openPRs: number; mergedPRs: number }
): StatsView {
	const inWindow = (iso: string | null | undefined) => !!iso && iso >= since;
	// Week 0 is the last 7 days, week CHART_WEEKS-1 the oldest; series are
	// stored oldest first
	const weekOf = (iso: string) => Math.floor((now.getTime() - new Date(iso).getTime()) / (WINDOW_DAYS * DAY));
	const slot = (iso: string) => CHART_WEEKS - 1 - weekOf(iso);
	const weeks: WeekPoint[] = Array.from({ length: CHART_WEEKS }, (_, i) => ({
		start: new Date(now.getTime() - (CHART_WEEKS - i) * WINDOW_DAYS * DAY).toISOString(),
		opened: 0,
		merged: 0
	}));

	const teamKey = (login: string) => login.toLowerCase();
	const onTeam = new Set(team.map(teamKey));
	const reviewers = new Map<string, ReviewerStat & { seen: Set<number> }>();
	const authors = new Map<string, AuthorStat>();
	for (const login of team) {
		const avatarUrl = `https://github.com/${login}.png`;
		reviewers.set(teamKey(login), {
			login,
			avatarUrl,
			prsReviewed: 0,
			reviews: 0,
			approvals: 0,
			weekly: Array(CHART_WEEKS).fill(0),
			seen: new Set<number>()
		});
		authors.set(teamKey(login), { login, avatarUrl, merged: 0, opened: 0, weekly: Array(CHART_WEEKS).fill(0) });
	}
	// Distinct PRs reviewed per member per week
	const reviewedWeeks = new Map<string, Set<string>>();

	const week = { newPRs: 0, mergedPRs: 0, closedPRs: 0 };
	const merged: MergedPullRequest[] = [];

	for (const pr of pulls) {
		if (!inView(spec, pr.baseRefName)) continue;
		const author = isHuman(pr.author) ? pr.author : null;
		const createdSlot = slot(pr.createdAt);
		if (createdSlot >= 0) weeks[createdSlot].opened++;
		if (pr.mergedAt) {
			const s = slot(pr.mergedAt);
			if (s >= 0) weeks[s].merged++;
		}

		if (inWindow(pr.createdAt)) week.newPRs++;
		if (inWindow(pr.mergedAt)) {
			week.mergedPRs++;
			merged.push({
				number: pr.number,
				title: pr.title,
				url: pr.url,
				author: pr.author?.login ?? 'ghost',
				mergedAt: pr.mergedAt!
			});
		} else if (pr.state === 'CLOSED' && inWindow(pr.closedAt)) {
			week.closedPRs++;
		}

		if (author && onTeam.has(teamKey(author.login))) {
			const stat = authors.get(teamKey(author.login))!;
			stat.avatarUrl = author.avatarUrl;
			if (inWindow(pr.createdAt)) stat.opened++;
			if (inWindow(pr.mergedAt)) stat.merged++;
			if (pr.mergedAt) {
				const s = slot(pr.mergedAt);
				if (s >= 0) stat.weekly[s]++;
			}
		}

		for (const review of pr.reviews.nodes) {
			if (!review.submittedAt || !isHuman(review.author) || !onTeam.has(teamKey(review.author.login))) continue;
			// Comments on your own pull request are not reviews
			if (author && review.author.login === author.login) continue;
			const stat = reviewers.get(teamKey(review.author.login))!;
			stat.avatarUrl = review.author.avatarUrl;
			const s = slot(review.submittedAt);
			if (s >= 0) {
				const mark = `${pr.number}:${s}`;
				const seenWeeks = reviewedWeeks.get(stat.login) ?? new Set<string>();
				if (!seenWeeks.has(mark)) {
					seenWeeks.add(mark);
					stat.weekly[s]++;
				}
				reviewedWeeks.set(stat.login, seenWeeks);
			}
			if (!inWindow(review.submittedAt)) continue;
			stat.reviews++;
			if (review.state === 'APPROVED') stat.approvals++;
			if (!stat.seen.has(pr.number)) {
				stat.seen.add(pr.number);
				stat.prsReviewed++;
			}
		}
	}

	const topReviewers = [...reviewers.values()]
		.sort((a, b) => b.prsReviewed - a.prsReviewed || b.reviews - a.reviews || a.login.localeCompare(b.login))
		.slice(0, LEADERBOARD_SIZE)
		.map(({ seen: _seen, ...rest }) => rest);
	const topAuthors = [...authors.values()]
		.sort((a, b) => b.merged - a.merged || b.opened - a.opened || a.login.localeCompare(b.login))
		.slice(0, LEADERBOARD_SIZE);
	merged.sort((a, b) => b.mergedAt.localeCompare(a.mergedAt));

	return {
		key: spec.key,
		label: spec.label,
		description: spec.description,
		totals,
		week,
		weeks,
		reviewers: topReviewers,
		authors: topAuthors,
		recentlyMerged: merged.slice(0, RECENT_MERGES)
	};
}

async function graphql<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
	const res = await fetch('https://api.github.com/graphql', {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'wheelofdeath.rip' },
		body: JSON.stringify({ query, variables })
	});
	if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
	const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
	if (!body.data) throw new Error(body.errors?.map((e) => e.message).join('; ') || 'Empty GraphQL response');
	return body.data;
}

async function rest<T>(token: string, path: string): Promise<T | null> {
	const res = await fetch(`https://api.github.com${path}`, {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'wheelofdeath.rip' }
	});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`GitHub responded ${res.status} for ${path}`);
	return (await res.json()) as T;
}

async function raw(path: string): Promise<string | null> {
	const res = await fetch(`https://raw.githubusercontent.com/${path}`, { headers: { 'User-Agent': 'wheelofdeath.rip' } });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`raw.githubusercontent.com responded ${res.status} for ${path}`);
	return res.text();
}

// "* [EIP-7928](./eip-7928.md): Block-Level Access Lists" under stage headings
function parseMetaEip(markdown: string): Map<number, { title: string; stage: EipStage }> {
	const out = new Map<number, { title: string; stage: EipStage }>();
	let stage: EipStage = 'Other';
	for (const line of markdown.split('\n')) {
		const heading = line.match(/^#{2,4}\s+(.*)$/);
		if (heading) {
			const h = heading[1].toLowerCase();
			stage = h.includes('scheduled') ? 'SFI'
				: h.includes('considered') ? 'CFI'
				: h.includes('proposed') ? 'PFI'
				: h.includes('declined') ? 'DFI'
				: h.includes('networking') ? 'Networking'
				: h.includes('informational') ? 'Informational'
				: stage;
			continue;
		}
		const item = line.match(/^\*\s+\[EIP-(\d+)\]\([^)]*\):\s*(.+?)\s*$/);
		if (item) out.set(Number(item[1]), { title: stripMarkdown(item[2]), stage });
	}
	return out;
}

function stripMarkdown(text: string): string {
	return text
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/`([^`]*)`/g, '$1')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\s+/g, ' ')
		.trim();
}

function metaStatus(markdown: string): string {
	return markdown.match(/^status:\s*(.+)$/m)?.[1].trim() ?? 'Draft';
}

// "| Sepolia | 353024 | 1791294816 (2026-10-06 13:53:36 UTC) |" rows under Activation
function parseActivations(markdown: string): ForkActivation[] {
	const out: ForkActivation[] = [];
	const section = markdown.split(/^### Activation/m)[1]?.split(/^## /m)[0] ?? '';
	for (const line of section.split('\n')) {
		const cells = line.split('|').map((c) => c.trim());
		if (cells.length < 4 || /^-+$/.test(cells[1]) || /network/i.test(cells[1])) continue;
		const date = cells[3].match(/\(([^)]+)\)/)?.[1] ?? (cells[3] ? cells[3] : null);
		out.push({ network: cells[1], epoch: cells[2], date: date || null });
	}
	return out;
}

// The tracker's "### Status" checklist and its "Target release tag"
function parseRelease(body: string, issue: number): ForkStage['release'] {
	const name = body.match(/Target release tag\*{0,2}:\s*`([^`]+)`/)?.[1];
	const section = body.split(/^### Status\s*$/m)[1]?.split(/^#{1,4} /m)[0];
	if (!name || !section) return null;
	const items: ReleaseItem[] = [];
	for (const line of section.split('\n')) {
		const box = line.match(/^\s*- \[( |x|X)\]\s*(.+)$/);
		if (box) items.push({ text: stripMarkdown(box[2]), done: box[1] !== ' ' });
	}
	return items.length ? { name, issue, items } : null;
}

// "| devnet | target | scope |" rows under "### Devnet Plan"
function parseDevnetPlan(body: string): DevnetPlanRow[] {
	const out: DevnetPlanRow[] = [];
	const section = body.split(/^### Devnet Plan/m)[1]?.split(/^#{1,4} /m)[0] ?? '';
	for (const line of section.split('\n')) {
		const cells = line.split('|').map((c) => c.trim());
		if (cells.length < 4 || /^-+$/.test(cells[1]) || /^devnet$/i.test(cells[1])) continue;
		out.push({ devnet: stripMarkdown(cells[1]), target: stripMarkdown(cells[2]), scope: stripMarkdown(cells[3]) });
	}
	return out;
}

// "| [N](...) | Title | Stage | [tracker](.../issues/M) | @a / @b |" rows
function parseAssignments(body: string): Map<number, { owners: string[]; trackerIssue: number | null }> {
	const out = new Map<number, { owners: string[]; trackerIssue: number | null }>();
	for (const line of body.split('\n')) {
		const m = line.match(/^\|\s*\[(\d+)\]\([^)]*\)\s*\|(.*)$/);
		if (!m) continue;
		const rest = m[2];
		const owners = [...rest.matchAll(/@([A-Za-z0-9-]+)/g)].map((x) => x[1]);
		const tracker = rest.match(/issues\/(\d+)/);
		out.set(Number(m[1]), { owners, trackerIssue: tracker ? Number(tracker[1]) : null });
	}
	return out;
}

// EIP numbers in the fork module's "### Changes" list
function parseModuleEips(source: string | null): Set<number> {
	const out = new Set<number>();
	if (!source) return out;
	for (const m of source.matchAll(/^- \[EIP-(\d+)/gm)) out.add(Number(m[1]));
	return out;
}

interface TrackerInfo {
	eips: Map<number, { title: string | null; owner: string | null; trackerIssue: number | null; done: number; total: number; hasBoxes: boolean }>;
}

// Two tracker shapes: "#### [EIP-N](...): title: #issue @owner" sections with
// checkboxes (Glamsterdam), and "| [N](...) - Title | ... |" table rows (Hegota)
function parseTracker(body: string): TrackerInfo {
	const eips: TrackerInfo['eips'] = new Map();
	const ensure = (n: number) => {
		if (!eips.has(n)) eips.set(n, { title: null, owner: null, trackerIssue: null, done: 0, total: 0, hasBoxes: false });
		return eips.get(n)!;
	};
	let current: number | null = null;
	let inPerEip = false;
	for (const line of body.split('\n')) {
		const section = line.match(/^#{4}\s+\[EIP-(\d+)\]\([^)]*\):?\s*(.*)$/);
		if (section) {
			current = Number(section[1]);
			inPerEip = true;
			const info = ensure(current);
			const rest = section[2];
			const owner = rest.match(/@([A-Za-z0-9-]+)/);
			info.owner = owner ? owner[1] : info.owner;
			const tracker = rest.match(/#(\d+)/);
			info.trackerIssue = tracker ? Number(tracker[1]) : info.trackerIssue;
			info.title = rest.replace(/:?\s*#\d+.*$/, '').replace(/\s*@.*$/, '').trim() || info.title;
			continue;
		}
		if (/^#{1,3}\s/.test(line)) {
			current = null;
			inPerEip = false;
			continue;
		}
		const row = line.match(/^\|\s*\[(\d+)\]\([^)]*eip-\d+\)\s*-\s*([^|]+?)\s*\|/);
		if (row) {
			const info = ensure(Number(row[1]));
			info.title = info.title ?? row[2].trim();
			continue;
		}
		if (inPerEip && current !== null) {
			const box = line.match(/^\s*- \[( |x|X)\]/);
			if (box) {
				const info = ensure(current);
				info.hasBoxes = true;
				info.total++;
				if (box[1] !== ' ') info.done++;
			}
		}
	}
	return { eips };
}

function mentionsEip(text: string, n: number): boolean {
	return new RegExp(`\\beip[- ]?${n}\\b`, 'i').test(text);
}

interface SearchPr {
	number: number;
	title: string;
	url: string;
	state: 'OPEN' | 'MERGED' | 'CLOSED';
	baseRefName: string;
}

interface GhRelease {
	tag_name: string;
	html_url: string;
	published_at: string | null;
	draft: boolean;
}

async function publishedReleases(token: string, repo: string): Promise<ReleaseLink[]> {
	const list = (await rest<GhRelease[]>(token, `/repos/${repo}/releases?per_page=60`)) ?? [];
	return list
		.filter((r) => !r.draft && r.published_at)
		.sort((a, b) => b.published_at!.localeCompare(a.published_at!))
		.map((r) => ({ tag: r.tag_name, url: r.html_url, date: r.published_at!.slice(0, 10) }));
}

// The newest release per prefix, newest first
function releasesFor(all: ReleaseLink[], prefixes: string[]): ReleaseLink[] {
	const out: ReleaseLink[] = [];
	for (const prefix of prefixes) {
		const hit = all.find((r) => r.tag.startsWith(prefix));
		if (hit) out.push(hit);
	}
	return out.sort((a, b) => b.date.localeCompare(a.date));
}

// Title and status from an EIP's front matter in ethereum/EIPs
async function eipFrontMatter(n: number): Promise<{ title: string; status: string } | null> {
	const md = await raw(`ethereum/EIPs/master/EIPS/eip-${n}.md`);
	if (!md) return null;
	return {
		title: md.match(/^title:\s*(.+)$/m)?.[1].trim() ?? `EIP-${n}`,
		status: md.match(/^status:\s*(.+)$/m)?.[1].trim() ?? 'Draft'
	};
}

async function prototypeBranches(token: string): Promise<Map<number, string>> {
	const out = new Map<number, string>();
	for (const prefix of PROTOTYPE_PREFIXES) {
		const refs = await graphql<{ repository: { refs: { nodes: { name: string }[] } } }>(
			token,
			`query($prefix: String!) { repository(owner: "${OWNER}", name: "${NAME}") { refs(refPrefix: $prefix, first: 100) { nodes { name } } } }`,
			{ prefix: `refs/heads/${prefix}` }
		);
		for (const ref of refs.repository.refs.nodes) {
			for (const m of ref.name.matchAll(/\d{3,5}/g)) {
				const n = Number(m[0]);
				if (ref.name === `eip-${n}` || !out.has(n)) out.set(n, `${prefix}${ref.name}`);
			}
		}
	}
	return out;
}

function candidateRow(n: number, title: string, stage: EipStage, note: string | null, branch: string | null): EipRow {
	return {
		number: n,
		title,
		url: `https://eips.ethereum.org/EIPS/eip-${n}`,
		stage,
		owner: null,
		spec: false,
		tests: false,
		branch,
		tracker: null,
		trackerIssue: null,
		prs: [],
		status: branch ? 'branch only' : 'not started',
		note
	};
}

// A fork with no meta EIP yet: headliner candidates, plus everything the
// previous fork declined or that was prototyped and never scheduled
async function buildCandidatesFork(token: string, spec: ForkSpec): Promise<ForkView> {
	const [branches, declinedMeta, ...fronts] = await Promise.all([
		prototypeBranches(token),
		spec.declinedFrom ? raw(`ethereum/EIPs/master/EIPS/eip-${spec.declinedFrom}.md`) : Promise.resolve(null),
		...spec.headliners.map((n) => eipFrontMatter(n))
	]);
	const headliners = spec.headliners.map((n, i) =>
		candidateRow(n, fronts[i]?.title ?? `EIP-${n}`, 'PFI', fronts[i] ? `${fronts[i].status} in ethereum/EIPs` : null, branches.get(n) ?? null)
	);

	// Listed anywhere in the known meta EIPs
	const listed = new Set<number>();
	const declined: EipRow[] = [];
	const metas = await Promise.all(FORKS.filter((f) => f.metaEip).map((f) => raw(`ethereum/EIPs/master/EIPS/eip-${f.metaEip}.md`)));
	for (const md of metas) {
		if (!md) continue;
		for (const [n, info] of parseMetaEip(md)) {
			listed.add(n);
			if (info.stage === 'DFI' && declinedMeta && md === declinedMeta) {
				declined.push(candidateRow(n, info.title, 'DFI', `Declined for the previous fork`, branches.get(n) ?? null));
			}
		}
	}
	// Prototyped in EELS but not in any meta EIP any more
	const dropped = [...branches.keys()].filter((n) => !listed.has(n) && !spec.headliners.includes(n) && !declined.some((d) => d.number === n)).sort((a, b) => a - b);
	const droppedFronts = await Promise.all(dropped.map((n) => eipFrontMatter(n)));
	dropped.forEach((n, i) => {
		declined.push(candidateRow(n, droppedFronts[i]?.title ?? `EIP-${n}`, 'DFI', droppedFronts[i] ? `Prototyped, ${droppedFronts[i].status.toLowerCase()} in ethereum/EIPs` : 'Prototyped, not in ethereum/EIPs', branches.get(n) ?? null));
	});
	declined.sort((a, b) => a.number - b.number);
	// Only EIPs with an EELS prototype branch are clearly execution-layer
	// work; the rest of the declined list is summarised in the note
	const prototyped = declined.filter((d) => d.branch);
	const others = declined.filter((d) => !d.branch).map((d) => d.number);

	const sections: EipSection[] = [
		{ title: '🌟 Headliner candidates', note: 'the big-ticket proposals in the running', eips: headliners },
		{
			title: '↩️ Declined or dropped, up for another go',
			note: `prototyped in EELS and not scheduled${others.length ? `; also declined without a prototype: ${others.map((n) => `EIP-${n}`).join(', ')}` : ''}`,
			eips: prototyped
		}
	];
	return {
		...emptyFork(spec),
		description: `Fork ${spec.position}, name to be decided`,
		stage: { label: 'Headliner selection', metaStatus: '—', activations: [], release: null, releases: [], devnets: [] },
		sections,
		summary: { eips: headliners.length + prototyped.length, implemented: 0, tested: 0, checkedOff: 0, inReview: 0 }
	};
}

function emptyFork(spec: ForkSpec): ForkView {
	return {
		key: spec.key,
		label: spec.label,
		position: spec.position,
		description: `Fork ${spec.position}`,
		placeholder: spec.placeholder,
		metaEip: spec.metaEip,
		trackerIssue: spec.trackerIssue,
		assignmentsIssue: spec.assignmentsIssue,
		branch: spec.branch,
		stage: { label: 'Not scoped', metaStatus: '—', activations: [], release: null, releases: [], devnets: [] },
		sections: [],
		summary: { eips: 0, implemented: 0, tested: 0, checkedOff: 0, inReview: 0 },
		eips: []
	};
}

async function buildFork(token: string, spec: ForkSpec, repo: string, releases: ReleaseLink[]): Promise<ForkView> {
	if (!spec.metaEip || !spec.branch || !spec.module || !spec.eipPrefix || !spec.trackerIssue) {
		return spec.headliners.length ? buildCandidatesFork(token, spec) : emptyFork(spec);
	}
	const [meta, moduleSource, testsDir, issue, assignmentsIssue] = await Promise.all([
		raw(`ethereum/EIPs/master/EIPS/eip-${spec.metaEip}.md`),
		raw(`${repo}/${spec.branch}/src/ethereum/forks/${spec.module}/__init__.py`),
		rest<{ name: string; type: string }[]>(token, `/repos/${repo}/contents/tests/${spec.module}?ref=${spec.branch}`),
		rest<{ body: string | null; html_url: string }>(token, `/repos/${repo}/issues/${spec.trackerIssue}`),
		spec.assignmentsIssue ? rest<{ body: string | null }>(token, `/repos/${repo}/issues/${spec.assignmentsIssue}`) : Promise.resolve(null)
	]);
	const metaEips = meta ? parseMetaEip(meta) : new Map<number, { title: string; stage: EipStage }>();
	const moduleEips = parseModuleEips(moduleSource);
	const assignments = parseAssignments(assignmentsIssue?.body ?? '');
	const testEips = new Set<number>();
	for (const entry of testsDir ?? []) {
		const m = entry.name.match(/^eip(\d+)_/);
		if (m && entry.type === 'dir') testEips.add(Number(m[1]));
	}
	const tracker = parseTracker(issue?.body ?? '');

	// Fork stage: the meta EIP's activations, the release checklist and the devnet plan
	const activations = meta ? parseActivations(meta) : [];
	const live = (network: string) => activations.find((a) => a.network.toLowerCase() === network && a.date);
	// Once a testnet is live the fork is in maintenance: the remaining
	// networks are preparation work rather than development
	const hasHeadliners = [...metaEips.values()].some((e) => e.stage === 'SFI');
	const stageLabel = live('mainnet') ? 'Live on mainnet'
		: live('hoodi') || live('sepolia') ? 'Maintenance mode'
		: moduleEips.size > 0 ? 'Devnets'
		: hasHeadliners ? 'Headliner devnets & fork scoping'
		: 'Scoping';
	const stage: ForkStage = {
		label: stageLabel,
		metaStatus: meta ? metaStatus(meta) : '—',
		activations,
		release: parseRelease(issue?.body ?? '', spec.trackerIssue),
		releases: releasesFor(releases, spec.releasePrefixes),
		devnets: parseDevnetPlan(issue?.body ?? '')
	};

	// EL scope: whatever the trackers, the module or the tests mention
	const numbers = new Set<number>([...tracker.eips.keys(), ...assignments.keys(), ...moduleEips, ...testEips]);

	// The EIPs' own branches
	const refs = await graphql<{ repository: { refs: { nodes: { name: string }[] } } }>(
		token,
		`query($prefix: String!) { repository(owner: "${OWNER}", name: "${NAME}") { refs(refPrefix: $prefix, first: 100) { nodes { name } } } }`,
		{ prefix: `refs/heads/${spec.eipPrefix}` }
	);
	const branchFor = new Map<number, string>();
	for (const ref of refs.repository.refs.nodes) {
		const nums = [...ref.name.matchAll(/\d{3,5}/g)].map((m) => Number(m[0]));
		for (const n of nums) {
			if (ref.name === `eip-${n}` || !branchFor.has(n)) branchFor.set(n, `${spec.eipPrefix}${ref.name}`);
		}
	}

	// Pull requests: into the fork branch, and into each EIP branch, one request
	const fields = [`base: search(query: "repo:${repo} is:pr base:${spec.branch}", type: ISSUE, first: 100) { nodes { ...pr } }`];
	const aliasFor = new Map<string, number>();
	for (const n of numbers) {
		const branch = branchFor.get(n);
		if (!branch) continue;
		const alias = `b${n}`;
		aliasFor.set(alias, n);
		fields.push(`${alias}: search(query: "repo:${repo} is:pr base:${branch}", type: ISSUE, first: 30) { nodes { ...pr } }`);
	}
	const prData = await graphql<Record<string, { nodes: SearchPr[] }>>(
		token,
		`fragment pr on PullRequest { number title url state baseRefName }\nquery { ${fields.join('\n')} }`
	);
	const toPr = (p: SearchPr): EipPullRequest => ({ number: p.number, title: p.title, url: p.url, state: p.state, base: p.baseRefName });
	const forkPrs = (prData.base?.nodes ?? []).filter((p) => p && typeof p.number === 'number');

	const stageOrder: EipStage[] = ['SFI', 'CFI', 'PFI', 'Networking', 'Informational', 'Other', 'DFI'];
	const rows: EipRow[] = [];
	for (const n of numbers) {
		const info = metaEips.get(n);
		const t = tracker.eips.get(n);
		const assigned = assignments.get(n);
		const prs: EipPullRequest[] = [];
		for (const [alias, num] of aliasFor) {
			if (num === n) prs.push(...(prData[alias]?.nodes ?? []).filter((p) => p && typeof p.number === 'number').map(toPr));
		}
		for (const p of forkPrs) {
			if (mentionsEip(p.title, n) && !prs.some((q) => q.number === p.number)) prs.push(toPr(p));
		}
		prs.sort((a, b) => b.number - a.number);
		const relevant = prs.filter((p) => p.state !== 'CLOSED');
		const implemented = moduleEips.has(n);
		const tests = testEips.has(n);
		const branch = branchFor.get(n) ?? null;
		const trackerTally = t?.hasBoxes ? { done: t.done, total: t.total } : null;
		const checkedOff = trackerTally ? trackerTally.done === trackerTally.total : true;
		let status: EipStatus;
		if (implemented && tests && checkedOff) status = 'done';
		else if (implemented) status = 'implemented';
		// Work merged into the fork branch without a module entry, such as a
		// networking EIP that only brings tests
		else if (relevant.some((p) => p.state === 'MERGED' && p.base === spec.branch)) status = 'landed';
		else if (relevant.some((p) => p.state === 'OPEN')) status = 'in review';
		else if (relevant.some((p) => p.state === 'MERGED' && p.base !== spec.branch)) status = 'on branch';
		else if (branch) status = 'branch only';
		else status = 'not started';
		rows.push({
			number: n,
			title: info?.title ?? t?.title ?? `EIP-${n}`,
			url: `https://eips.ethereum.org/EIPS/eip-${n}`,
			stage: info?.stage ?? 'Other',
			owner: assigned?.owners.length ? assigned.owners.join(' / ') : (t?.owner ?? null),
			spec: implemented,
			tests,
			branch,
			tracker: trackerTally,
			trackerIssue: assigned?.trackerIssue ?? t?.trackerIssue ?? null,
			prs: relevant.slice(0, 6),
			status,
			note: null
		});
	}
	rows.sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage) || a.number - b.number);

	return {
		key: spec.key,
		label: spec.label,
		position: spec.position,
		description: `EL EIPs for ${spec.label}, from EIP-${spec.metaEip} and tracker #${spec.trackerIssue}${spec.assignmentsIssue ? ` + #${spec.assignmentsIssue}` : ''}, against ${spec.branch}`,
		placeholder: null,
		metaEip: spec.metaEip,
		trackerIssue: spec.trackerIssue,
		assignmentsIssue: spec.assignmentsIssue,
		branch: spec.branch,
		stage,
		sections: [],
		summary: {
			eips: rows.length,
			implemented: rows.filter((r) => r.spec).length,
			tested: rows.filter((r) => r.tests).length,
			checkedOff: rows.filter((r) => r.status === 'done').length,
			inReview: rows.filter((r) => r.status === 'in review').length
		},
		eips: rows
	};
}

export async function buildStats(token: string, team: string[]): Promise<RepoStats> {
	const now = new Date();
	const since = new Date(now.getTime() - WINDOW_DAYS * DAY).toISOString();
	const chartSince = new Date(now.getTime() - CHART_WEEKS * WINDOW_DAYS * DAY).toISOString();
	const repo = `${OWNER}/${NAME}`;
	const variables = {
		prQuery: `repo:${repo} is:pr updated:>=${chartSince}`,
		newIssueQuery: `repo:${repo} is:issue created:>=${since}`,
		closedIssueQuery: `repo:${repo} is:issue closed:>=${since}`
	};

	// Every review, merge or close bumps a pull request's updatedAt, so the
	// ones updated inside the chart window cover everything the charts need
	let first: GqlPage | null = null;
	const pulls: GqlPullRequest[] = [];
	let after: string | null = null;
	for (let page = 0; page < MAX_PAGES; page++) {
		const data: GqlPage = await fetchPage(token, { ...variables, after });
		first ??= data;
		pulls.push(...data.recent.nodes.filter((n) => n && typeof n.number === 'number'));
		if (!data.recent.pageInfo.hasNextPage) break;
		after = data.recent.pageInfo.endCursor;
	}
	if (!first) throw new Error('No data from GitHub');

	const r = first.repository;
	const releases = await publishedReleases(token, repo);
	const forks: ForkView[] = [];
	for (const spec of FORKS) forks.push(await buildFork(token, spec, repo, releases));

	return {
		repo,
		fetchedAt: now.toISOString(),
		since,
		windowDays: WINDOW_DAYS,
		chartWeeks: CHART_WEEKS,
		totals: {
			stars: r.stargazerCount,
			forks: r.forkCount,
			openIssues: r.openIssues.totalCount,
			closedIssues: r.closedIssues.totalCount
		},
		week: {
			newIssues: first.newIssues.issueCount,
			closedIssues: first.closedIssuesInWindow.issueCount
		},
		latestRelease: releases[0] ?? null,
		eels: buildView(EELS_VIEW, pulls, team, now, since, { openPRs: r.openPRs.totalCount, mergedPRs: r.mergedPRs.totalCount }),
		forks
	};
}
