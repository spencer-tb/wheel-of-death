// The team the leaderboards are about. No imports, so the stats script can
// load this under plain Node as well as the app.
export interface TeamMember {
	name: string;
	github: string;
}

export const TEAM: TeamMember[] = [
	{ name: 'Spencer', github: 'spencer-tb' },
	{ name: 'Jochem', github: 'jochem-brouwer' },
	{ name: 'Guru', github: 'gurukamath' },
	{ name: 'Louis', github: 'LouisTsai-Csie' },
	{ name: 'Dan', github: 'danceratopz' },
	{ name: 'Felipe', github: 'fselmo' },
	{ name: 'Mario', github: 'marioevz' }
];
