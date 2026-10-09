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

// A GitHub user on the stats leaderboards
export interface StatsPerson {
	login: string;
	avatarUrl: string;
}

export interface ReviewerStat extends StatsPerson {
	prsReviewed: number;
	reviews: number;
	approvals: number;
	weekly: number[]; // PRs reviewed per week, oldest week first
}

export interface AuthorStat extends StatsPerson {
	merged: number;
	opened: number;
	weekly: number[]; // PRs merged per week, oldest week first
}

export interface MergedPullRequest {
	number: number;
	title: string;
	url: string;
	author: string;
	mergedAt: string;
}

export interface WeekPoint {
	start: string; // ISO timestamp of the week's start
	opened: number;
	merged: number;
}

// The EELS tab: repo-wide activity
export interface StatsView {
	key: string;
	label: string;
	description: string;
	totals: {
		openPRs: number;
		mergedPRs: number;
	};
	week: {
		newPRs: number;
		mergedPRs: number;
		closedPRs: number;
	};
	weeks: WeekPoint[];
	reviewers: ReviewerStat[];
	authors: AuthorStat[];
	recentlyMerged: MergedPullRequest[];
}

// A fork tab: every EL EIP in scope for the fork and where it stands
export type EipStage = 'SFI' | 'CFI' | 'PFI' | 'DFI' | 'Networking' | 'Informational' | 'Other';

export type EipStatus = 'done' | 'implemented' | 'landed' | 'in review' | 'on branch' | 'branch only' | 'not started';

export interface EipPullRequest {
	number: number;
	title: string;
	url: string;
	state: 'OPEN' | 'MERGED' | 'CLOSED';
	base: string;
}

export interface EipRow {
	number: number;
	title: string;
	url: string;
	stage: EipStage;
	owner: string | null; // GitHub login from the tracker, if named
	spec: boolean; // listed in the fork module on the fork branch
	tests: boolean; // tests directory on the fork branch
	branch: string | null; // the EIP's own branch, if it exists
	tracker: { done: number; total: number } | null; // checkbox tally from the tracker issue
	trackerIssue: number | null; // the EIP's own tracker issue
	prs: EipPullRequest[];
	status: EipStatus;
	note: string | null; // free text, such as the EIP's status in ethereum/EIPs
}

// A list of EIPs shown as its own small table on a fork tab
export interface EipSection {
	title: string;
	note: string;
	eips: EipRow[];
}

export interface ForkActivation {
	network: string;
	epoch: string;
	date: string | null; // "2026-10-06 13:53:36 UTC" style, from the meta EIP
}

export interface ReleaseItem {
	text: string;
	done: boolean;
}

export interface ReleaseLink {
	tag: string;
	url: string;
	date: string; // YYYY-MM-DD
}

export interface DevnetPlanRow {
	devnet: string;
	target: string;
	scope: string;
}

// Where the fork is: activations from the meta EIP, the test release
// tracker's top-level checklist, and the devnet plan
export interface ForkStage {
	label: string;
	metaStatus: string;
	activations: ForkActivation[];
	release: { name: string; issue: number; items: ReleaseItem[] } | null;
	releases: ReleaseLink[]; // latest published releases relevant to the fork
	devnets: DevnetPlanRow[];
}

export interface ForkView {
	key: string;
	label: string;
	position: string; // N, N+1, N+2
	description: string;
	placeholder: string | null; // shown instead of a table when nothing is scoped yet
	metaEip: number | null;
	trackerIssue: number | null;
	assignmentsIssue: number | null;
	branch: string | null;
	stage: ForkStage;
	sections: EipSection[];
	summary: {
		eips: number;
		implemented: number;
		tested: number;
		checkedOff: number;
		inReview: number;
	};
	eips: EipRow[];
}

export interface RepoStats {
	repo: string;
	fetchedAt: string; // ISO timestamp
	since: string; // start of the leaderboard window, ISO timestamp
	windowDays: number;
	chartWeeks: number;
	totals: {
		stars: number;
		forks: number;
		openIssues: number;
		closedIssues: number;
	};
	week: {
		newIssues: number;
		closedIssues: number;
	};
	latestRelease: ReleaseLink | null;
	eels: StatsView;
	forks: ForkView[];
}
