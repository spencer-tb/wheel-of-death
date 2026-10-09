<script lang="ts">
	import { onMount } from 'svelte';
	import type { EipRow, EipStatus, ForkView, RepoStats, StatsView, WeekPoint } from '$lib/types';

	interface Props {
		darkMode?: boolean;
		// The desktop settings panel floats over the right edge of the page
		panelOpen?: boolean;
	}

	let { darkMode = false, panelOpen = false }: Props = $props();

	let section: HTMLElement;
	let stats = $state<RepoStats | null>(null);
	let status = $state<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
	let tab = $state('eels');
	let hoveredWeek = $state<number | null>(null);

	// The EELS tab is activity; fork tabs are EIP trackers
	const tabs = $derived(stats ? [{ key: stats.eels.key, label: stats.eels.label }, ...stats.forks.map((f) => ({ key: f.key, label: f.position ? `${f.position} · ${f.label}` : f.label }))] : []);
	const fork = $derived<ForkView | null>(stats ? (stats.forks.find((f) => f.key === tab) ?? null) : null);
	const view = $derived<StatsView | null>(stats && !fork ? stats.eels : null);
	const description = $derived(fork?.description ?? (view ? `${view.description} in ${stats?.repo}` : ''));

	const STATUS_STYLE: Record<EipStatus, { label: string; light: string; dark: string }> = {
		done: { label: 'Checked off', light: 'bg-emerald-100 text-emerald-800', dark: 'bg-emerald-900 text-emerald-200' },
		implemented: { label: 'Implemented', light: 'bg-indigo-100 text-indigo-800', dark: 'bg-indigo-900 text-indigo-200' },
		landed: { label: 'Landed in fork', light: 'bg-teal-100 text-teal-800', dark: 'bg-teal-900 text-teal-200' },
		'in review': { label: 'In review', light: 'bg-amber-100 text-amber-800', dark: 'bg-amber-900 text-amber-200' },
		'on branch': { label: 'On branch', light: 'bg-sky-100 text-sky-800', dark: 'bg-sky-900 text-sky-200' },
		'branch only': { label: 'Branch only', light: 'bg-slate-200 text-slate-700', dark: 'bg-slate-700 text-slate-200' },
		'not started': { label: 'Not started', light: 'bg-slate-100 text-slate-500', dark: 'bg-slate-800 text-slate-400' }
	};

	const forkTiles = $derived(fork ? [
		{ label: 'EL EIPs', value: fork.summary.eips, hint: 'in scope' },
		{ label: 'Implemented', value: fork.summary.implemented, hint: `on ${fork.branch}` },
		{ label: 'Tested', value: fork.summary.tested, hint: 'test directory' },
		{ label: 'Checked off', value: fork.summary.checkedOff, hint: 'spec, tests, tracker' },
		{ label: 'In review', value: fork.summary.inReview, hint: 'open PRs' },
	] : []);

	async function load() {
		if (status !== 'idle') return;
		status = 'loading';
		try {
			const res = await fetch('/api/github-stats');
			if (!res.ok) throw new Error(String(res.status));
			stats = (await res.json()) as RepoStats;
			status = 'ready';
		} catch {
			status = 'unavailable';
		}
	}

	function selectTab(key: string) {
		tab = key;
		hoveredWeek = null;
		try {
			localStorage.setItem('statsTab', key);
		} catch {
			// Private mode or blocked storage: the tab just does not stick
		}
	}

	// Fetch only once the section scrolls into view, so the wheel never waits
	onMount(() => {
		try {
			const saved = localStorage.getItem('statsTab');
			if (saved) tab = saved;
		} catch {
			// ignore
		}
		if (!('IntersectionObserver' in window)) {
			load();
			return;
		}
		const observer = new IntersectionObserver((entries) => {
			if (entries.some((e) => e.isIntersecting)) {
				load();
				observer.disconnect();
			}
		}, { rootMargin: '200px' });
		observer.observe(section);
		return () => observer.disconnect();
	});

	const MEDALS = ['🥇', '🥈', '🥉'];

	// Chart colours, validated for each surface: merged is indigo, opened amber
	const colors = $derived(darkMode
		? { opened: '#d97706', merged: '#6366f1', grid: '#334155', ink: '#cbd5e1', muted: '#94a3b8' }
		: { opened: '#f59e0b', merged: '#4f46e5', grid: '#e2e8f0', ink: '#334155', muted: '#94a3b8' });

	function smallAvatar(url: string): string {
		return url + (url.includes('?') ? '&' : '?') + 's=64';
	}

	function ago(iso: string): string {
		const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes} min ago`;
		const hours = Math.round(minutes / 60);
		return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
	}

	function weekLabel(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
	}

	const tiles = $derived(stats && view ? (view.key === 'eels' ? [
		{ label: 'Open PRs', value: view.totals.openPRs, hint: 'right now' },
		{ label: 'New PRs', value: view.week.newPRs, hint: 'this week' },
		{ label: 'Merged', value: view.week.mergedPRs, hint: 'this week' },
		{ label: 'Closed unmerged', value: view.week.closedPRs, hint: 'this week' },
		{ label: 'Open issues', value: stats.totals.openIssues, hint: 'right now' },
		{ label: 'New issues', value: stats.week.newIssues, hint: 'this week' },
		{ label: 'Issues closed', value: stats.week.closedIssues, hint: 'this week' },
		{ label: 'PRs merged', value: view.totals.mergedPRs, hint: 'all time' },
	] : [
		{ label: 'Open PRs', value: view.totals.openPRs, hint: 'right now' },
		{ label: 'New PRs', value: view.week.newPRs, hint: 'this week' },
		{ label: 'Merged', value: view.week.mergedPRs, hint: 'this week' },
		{ label: 'Closed unmerged', value: view.week.closedPRs, hint: 'this week' },
		{ label: 'PRs merged', value: view.totals.mergedPRs, hint: 'all time' },
	]) : []);

	// Grouped weekly bars. One y axis, bars anchored to the baseline with
	// rounded tops, a 2px gap between the pair.
	const chart = { width: 640, height: 220, left: 36, right: 12, top: 16, bottom: 28 };
	const plotW = chart.width - chart.left - chart.right;
	const plotH = chart.height - chart.top - chart.bottom;

	function yMax(weeks: WeekPoint[]): number {
		return Math.max(1, ...weeks.map((w) => Math.max(w.opened, w.merged)));
	}

	function ticks(max: number): number[] {
		const half = Math.round(max / 2);
		return half > 0 && half < max ? [0, half, max] : [0, max];
	}

	function bar(x: number, value: number, max: number, width: number): string {
		const h = (value / max) * plotH;
		const y = chart.top + plotH - h;
		const r = Math.min(4, width / 2, h);
		const bottom = chart.top + plotH;
		if (h <= 0) return '';
		return `M${x} ${bottom} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + width - r} Q${x + width} ${y} ${x + width} ${y + r} V${bottom} Z`;
	}

	function sparkline(values: number[], w = 72, h = 20): string {
		const max = Math.max(1, ...values);
		const step = values.length > 1 ? w / (values.length - 1) : 0;
		return values
			.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`)
			.join(' ');
	}
</script>

<section
	bind:this={section}
	class="py-10 px-4 min-[640px]:px-8 transition-[padding,background-color]"
	class:bg-slate-200={!darkMode}
	class:bg-slate-900={darkMode}
	class:min-[900px]:pr-[472px]={panelOpen}
>
	{#if status === 'ready' && stats}
		<div class="max-w-5xl mx-auto @container">
			<div class="flex flex-wrap items-baseline justify-between gap-2 mb-4">
				<h2 class="text-2xl font-bold" class:text-gray-800={!darkMode} class:text-white={darkMode}>📊 Execution layer tracker</h2>
				<span class="text-xs" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}>
					{#if stats.latestRelease}latest release <a href={stats.latestRelease.url} target="_blank" rel="noopener noreferrer" class="font-mono hover:underline">{stats.latestRelease.tag}</a> · {/if}last {stats.windowDays} days · updated {ago(stats.fetchedAt)}
				</span>
			</div>

			<!-- Tabs -->
			<div class="flex gap-1 mb-1 border-b" class:border-slate-300={!darkMode} class:border-slate-700={darkMode} role="tablist">
				{#each tabs as t (t.key)}
					{@const active = t.key === (fork?.key ?? view?.key)}
					<button
						role="tab"
						aria-selected={active}
						onclick={() => selectTab(t.key)}
						class="px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors"
						class:border-indigo-600={active && !darkMode}
						class:text-indigo-700={active && !darkMode}
						class:border-indigo-400={active && darkMode}
						class:text-indigo-300={active && darkMode}
						class:border-transparent={!active}
						class:text-gray-500={!active && !darkMode}
						class:hover:text-gray-800={!active && !darkMode}
						class:text-gray-400={!active && darkMode}
						class:hover:text-gray-200={!active && darkMode}
					>{t.label}</button>
				{/each}
			</div>
			<p class="text-xs mb-5" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}>{description}</p>

		{#if fork}
			{@const stage = fork.stage}
			{@const release = stage?.release ?? null}
			{@const releaseDone = release ? release.items.filter((i) => i.done).length : 0}
			<!-- Fork stage -->
			<div class="rounded-xl p-5 shadow-sm mb-6 grid grid-cols-1 @3xl:grid-cols-2 gap-6" class:bg-white={!darkMode} class:bg-slate-800={darkMode}>
				<div>
					<div class="text-xs uppercase tracking-wide" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}>Fork stage</div>
					<div class="text-2xl font-bold" data-stage-label class:text-gray-800={!darkMode} class:text-white={darkMode}>{stage?.label ?? '…'}</div>
					{#if fork.metaEip}
						<div class="text-xs" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}>
							<a href="https://eips.ethereum.org/EIPS/eip-{fork.metaEip}" target="_blank" rel="noopener noreferrer" class="hover:underline">EIP-{fork.metaEip}</a> · {stage?.metaStatus ?? '—'}
						</div>
					{/if}
					{#if stage?.releases?.length}
						<div class="mt-3 text-xs uppercase tracking-wide" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}>Latest releases</div>
						<ul class="mt-1 space-y-0.5 text-sm" data-releases>
							{#each stage.releases as r (r.tag)}
								<li class="flex items-baseline gap-2">
									<a href={r.url} target="_blank" rel="noopener noreferrer" class="font-mono hover:underline" class:text-indigo-600={!darkMode} class:text-indigo-400={darkMode}>{r.tag}</a>
									<span class="text-xs" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}>{r.date}</span>
								</li>
							{/each}
						</ul>
					{/if}
					{#if stage?.activations?.length}
						<ul class="mt-3 space-y-1 text-sm">
							{#each stage.activations as a (a.network)}
								<li class="flex items-center gap-2">
									<span aria-hidden="true">{a.date ? '✅' : stage.label === 'Maintenance mode' ? '🛠️' : '○'}</span>
									<span class="w-20 font-medium" class:text-gray-700={!darkMode} class:text-gray-200={darkMode}>{a.network}</span>
									<span class="text-xs" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}>{a.date ? `live since ${a.date}` : stage.label === 'Maintenance mode' ? 'preparation' : 'not scheduled'}{a.epoch ? ` · epoch ${a.epoch}` : ''}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
				<div>
					{#if release}
						<div class="text-xs uppercase tracking-wide" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}>
							Test release · <a href="https://github.com/{stats.repo}/issues/{release.issue}" target="_blank" rel="noopener noreferrer" class="hover:underline">#{release.issue}</a>
						</div>
						{@const releaseLink = stage?.releases?.find((r) => r.tag === release.name) ?? null}
						<div class="font-semibold font-mono" class:text-gray-800={!darkMode} class:text-white={darkMode}>
							{#if releaseLink}<a href={releaseLink.url} target="_blank" rel="noopener noreferrer" class="hover:underline">{release.name}</a>{:else}{release.name}{/if}
							<span class="text-xs font-sans font-normal" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}>{releaseDone} of {release.items.length} done</span>
						</div>
						<ul class="mt-2 space-y-1 text-sm">
							{#each release.items as item, i (i)}
								<li class="flex gap-2" class:opacity-50={item.done}>
									<span aria-hidden="true">{item.done ? '✅' : '⬜'}</span>
									<span class:line-through={item.done} class:text-gray-700={!darkMode} class:text-gray-200={darkMode}>{item.text}</span>
								</li>
							{/each}
						</ul>
					{:else if fork.placeholder}
						<p class="text-sm" class:text-gray-600={!darkMode} class:text-gray-300={darkMode}>{fork.placeholder}</p>
					{/if}
				</div>
			</div>

			{#if stage?.devnets?.length}
				<div class="rounded-xl p-5 shadow-sm mb-6 overflow-x-auto" class:bg-white={!darkMode} class:bg-slate-800={darkMode}>
					<h3 class="text-lg font-semibold mb-3" class:text-gray-800={!darkMode} class:text-white={darkMode}>🧪 Devnet plan <span class="text-xs font-normal" class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>from tracker #{fork.trackerIssue}, internal and not yet agreed</span></h3>
					<table class="w-full text-sm min-w-[520px]">
						<thead>
							<tr class="text-left text-xs uppercase tracking-wide" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}><th class="py-1 pr-3 font-medium">Devnet</th><th class="py-1 pr-3 font-medium">Target</th><th class="py-1 font-medium">Scope</th></tr>
						</thead>
						<tbody>
							{#each stage.devnets as d (d.devnet)}
								<tr class="border-t" class:border-slate-100={!darkMode} class:border-slate-700={darkMode}>
									<td class="py-1.5 pr-3 font-mono whitespace-nowrap" class:text-indigo-600={!darkMode} class:text-indigo-400={darkMode}>{d.devnet}</td>
									<td class="py-1.5 pr-3 whitespace-nowrap" class:text-gray-700={!darkMode} class:text-gray-200={darkMode}>{d.target}</td>
									<td class="py-1.5" class:text-gray-600={!darkMode} class:text-gray-300={darkMode}>{d.scope}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			{#each fork.sections ?? [] as section (section.title)}
				<div class="rounded-xl p-5 shadow-sm mb-6 overflow-x-auto" class:bg-white={!darkMode} class:bg-slate-800={darkMode}>
					<h3 class="text-lg font-semibold mb-3" class:text-gray-800={!darkMode} class:text-white={darkMode}>{section.title} <span class="text-xs font-normal" class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>{section.note}</span></h3>
					{#if section.eips.length === 0}
						<p class="text-sm" class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>Nothing here yet</p>
					{:else}
						<table class="w-full text-sm min-w-[560px]" data-section-table>
							<thead>
								<tr class="text-left text-xs uppercase tracking-wide" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}><th class="py-1 pr-3 font-medium">EIP</th><th class="py-1 pr-3 font-medium">Title</th><th class="py-1 pr-3 font-medium">Note</th><th class="py-1 font-medium">EELS</th></tr>
							</thead>
							<tbody>
								{#each section.eips as eip (eip.number)}
									<tr class="border-t" class:border-slate-100={!darkMode} class:border-slate-700={darkMode}>
										<td class="py-1.5 pr-3"><a href={eip.url} target="_blank" rel="noopener noreferrer" class="font-mono font-semibold hover:underline" class:text-indigo-600={!darkMode} class:text-indigo-400={darkMode}>{eip.number}</a></td>
										<td class="py-1.5 pr-3" class:text-gray-700={!darkMode} class:text-gray-200={darkMode}>{eip.title}</td>
										<td class="py-1.5 pr-3 text-xs" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}>{eip.note ?? ''}</td>
										<td class="py-1.5 text-xs whitespace-nowrap">
											{#if eip.branch}
												<a href="https://github.com/{stats.repo}/tree/{eip.branch}" target="_blank" rel="noopener noreferrer" class="font-mono hover:underline" class:text-indigo-600={!darkMode} class:text-indigo-400={darkMode}>{eip.branch}</a>
											{:else}
												<span class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>—</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</div>
			{/each}

			{#if fork.eips.length > 0}
			<!-- Fork tracker -->
			<div class="grid grid-cols-2 @2xl:grid-cols-5 gap-3 mb-6">
				{#each forkTiles as tile (tile.label)}
					<div class="rounded-xl p-4 shadow-sm" class:bg-white={!darkMode} class:bg-slate-800={darkMode}>
						<div class="text-3xl font-bold tabular-nums" class:text-indigo-600={!darkMode} class:text-indigo-400={darkMode}>{tile.value}</div>
						<div class="text-sm font-medium" class:text-gray-700={!darkMode} class:text-gray-200={darkMode}>{tile.label}</div>
						<div class="text-xs truncate" class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>{tile.hint}</div>
					</div>
				{/each}
			</div>

			<div class="rounded-xl shadow-sm overflow-x-auto" class:bg-white={!darkMode} class:bg-slate-800={darkMode}>
				<table class="w-full text-sm min-w-[720px]" data-eip-table>
					<thead>
						<tr class="text-left text-xs uppercase tracking-wide" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}>
							<th class="px-4 py-3 font-medium">EIP</th>
							<th class="px-2 py-3 font-medium">Stage</th>
							<th class="px-2 py-3 font-medium">Owner</th>
							<th class="px-2 py-3 font-medium text-center">Spec</th>
							<th class="px-2 py-3 font-medium text-center">Tests</th>
							<th class="px-2 py-3 font-medium">Tracker</th>
							<th class="px-2 py-3 font-medium">Status</th>
							<th class="px-4 py-3 font-medium">PRs</th>
						</tr>
					</thead>
					<tbody>
						{#each fork.eips as eip (eip.number)}
							{@const style = STATUS_STYLE[eip.status]}
							<tr class="border-t" class:border-slate-100={!darkMode} class:border-slate-700={darkMode}>
								<td class="px-4 py-2.5">
									<a href={eip.url} target="_blank" rel="noopener noreferrer" class="font-mono font-semibold hover:underline" class:text-indigo-600={!darkMode} class:text-indigo-400={darkMode}>{eip.number}</a>
									<div class="text-xs max-w-[260px] truncate" title={eip.title} class:text-gray-600={!darkMode} class:text-gray-300={darkMode}>{eip.title}</div>
								</td>
								<td class="px-2 py-2.5 text-xs" class:text-gray-600={!darkMode} class:text-gray-300={darkMode}>{eip.stage}</td>
								<td class="px-2 py-2.5" data-owner>
									{#if eip.owner}
										{@const owners = eip.owner.split(' / ')}
										<div class="flex items-center gap-1.5">
											<div class="flex -space-x-1.5">
												{#each owners as login (login)}
													<a href="https://github.com/{login}" target="_blank" rel="noopener noreferrer" title={login}>
														<img src="https://github.com/{login}.png?size=48" alt={login} class="w-6 h-6 rounded-full ring-2" class:ring-white={!darkMode} class:ring-slate-800={darkMode} loading="lazy" />
													</a>
												{/each}
											</div>
											<span class="text-xs whitespace-nowrap" class:text-gray-600={!darkMode} class:text-gray-300={darkMode}>{owners.length === 1 ? owners[0] : `${owners.length} people`}</span>
										</div>
									{:else}
										<span class="text-xs italic" class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>unassigned</span>
									{/if}
								</td>
								<td class="px-2 py-2.5 text-center" title={eip.spec ? `In the fork module on ${fork.branch}` : 'Not in the fork module'}>{eip.spec ? '✅' : '—'}</td>
								<td class="px-2 py-2.5 text-center" title={eip.tests ? 'Tests directory exists' : 'No tests directory'}>{eip.tests ? '✅' : '—'}</td>
								<td class="px-2 py-2.5 text-xs tabular-nums" class:text-gray-600={!darkMode} class:text-gray-300={darkMode}>
									{#if eip.tracker}
										<a href="https://github.com/{stats.repo}/issues/{fork.trackerIssue}" target="_blank" rel="noopener noreferrer" class="hover:underline" title="{eip.tracker.done} of {eip.tracker.total} tracker items checked">
											{eip.tracker.done}/{eip.tracker.total}
											<span class="inline-block align-middle w-12 h-1.5 rounded-full ml-1" class:bg-slate-200={!darkMode} class:bg-slate-600={darkMode}>
												<span class="block h-full rounded-full" class:bg-emerald-500={eip.tracker.done === eip.tracker.total} class:bg-indigo-500={eip.tracker.done !== eip.tracker.total} style="width: {Math.round((eip.tracker.done / Math.max(1, eip.tracker.total)) * 100)}%"></span>
											</span>
										</a>
									{/if}
									{#if eip.trackerIssue}
										<a href="https://github.com/{stats.repo}/issues/{eip.trackerIssue}" target="_blank" rel="noopener noreferrer" class="font-mono hover:underline" class:ml-2={!!eip.tracker} class:text-indigo-600={!darkMode} class:text-indigo-400={darkMode} title="EIP tracker issue">#{eip.trackerIssue}</a>
									{:else if !eip.tracker}
										—
									{/if}
								</td>
								<td class="px-2 py-2.5">
									<span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap {darkMode ? style.dark : style.light}">{style.label}</span>
								</td>
								<td class="px-4 py-2.5 text-xs whitespace-nowrap">
									{#each eip.prs.slice(0, 3) as pr (pr.number)}
										<a href={pr.url} target="_blank" rel="noopener noreferrer" class="font-mono mr-2 hover:underline" title="{pr.state.toLowerCase()}: {pr.title} → {pr.base}" class:text-emerald-600={pr.state === 'MERGED' && !darkMode} class:text-emerald-400={pr.state === 'MERGED' && darkMode} class:text-amber-600={pr.state === 'OPEN' && !darkMode} class:text-amber-400={pr.state === 'OPEN' && darkMode}>#{pr.number}</a>
									{/each}
									{#if eip.prs.length === 0 && eip.branch}
										<a href="https://github.com/{stats.repo}/tree/{eip.branch}" target="_blank" rel="noopener noreferrer" class="hover:underline" class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>branch</a>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="text-[11px] mt-3" class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>
				Scope: <a href="https://eips.ethereum.org/EIPS/eip-{fork.metaEip}" target="_blank" rel="noopener noreferrer" class="hover:underline">EIP-{fork.metaEip}</a> and
				<a href="https://github.com/{stats.repo}/issues/{fork.trackerIssue}" target="_blank" rel="noopener noreferrer" class="hover:underline">tracker #{fork.trackerIssue}</a>.
				Spec means the EIP is listed in the fork module, tests that its test directory exists, both on {fork.branch}. Merged PRs are green, open ones amber.
			</p>
			{/if}
		{:else if view}
			{@const groupW = plotW / view.weeks.length}
			{@const barW = Math.floor((groupW - 14) / 2)}
			{@const max = yMax(view.weeks)}

			<!-- Overview tiles -->
			<div class="grid grid-cols-2 @2xl:grid-cols-4 gap-3 mb-6">
				{#each tiles as tile (tile.label)}
					<div
						class="rounded-xl p-4 shadow-sm"
						class:bg-white={!darkMode}
						class:bg-slate-800={darkMode}
					>
						<div class="text-3xl font-bold tabular-nums" class:text-indigo-600={!darkMode} class:text-indigo-400={darkMode}>{tile.value.toLocaleString()}</div>
						<div class="text-sm font-medium" class:text-gray-700={!darkMode} class:text-gray-200={darkMode}>{tile.label}</div>
						<div class="text-xs" class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>{tile.hint}</div>
					</div>
				{/each}
			</div>

			<!-- Weekly chart -->
			<div class="rounded-xl p-5 shadow-sm mb-6" class:bg-white={!darkMode} class:bg-slate-800={darkMode}>
				<div class="flex flex-wrap items-center justify-between gap-2 mb-2">
					<h3 class="text-lg font-semibold" class:text-gray-800={!darkMode} class:text-white={darkMode}>Pull requests per week <span class="text-xs font-normal" class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>rolling {stats.chartWeeks} weeks</span></h3>
					<div class="flex items-center gap-4 text-xs" class:text-gray-600={!darkMode} class:text-gray-300={darkMode}>
						<span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded-sm" style="background: {colors.opened}"></span>Opened</span>
						<span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded-sm" style="background: {colors.merged}"></span>Merged</span>
					</div>
				</div>
				<p class="text-xs h-4 mb-1 tabular-nums" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}>
					{#if hoveredWeek !== null}
						Week of {weekLabel(view.weeks[hoveredWeek].start)}: {view.weeks[hoveredWeek].opened} opened, {view.weeks[hoveredWeek].merged} merged
					{:else}
						Hover a week for its numbers
					{/if}
				</p>
				<svg viewBox="0 0 {chart.width} {chart.height}" class="w-full h-auto" role="img" aria-label="Pull requests opened and merged per week" onmouseleave={() => (hoveredWeek = null)}>
					{#each ticks(max) as t (t)}
						{@const y = chart.top + plotH - (t / max) * plotH}
						<line x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} stroke={colors.grid} stroke-width="1" />
						<text x={chart.left - 6} y={y + 3} text-anchor="end" font-size="10" fill={colors.muted}>{t}</text>
					{/each}
					{#each view.weeks as w, i (w.start)}
						{@const x0 = chart.left + i * groupW + (groupW - (2 * barW + 2)) / 2}
						{@const isLast = i === view.weeks.length - 1}
						{@const dim = hoveredWeek !== null && hoveredWeek !== i}
						<g opacity={dim ? 0.45 : 1}>
							<path d={bar(x0, w.opened, max, barW)} fill={colors.opened} />
							<path d={bar(x0 + barW + 2, w.merged, max, barW)} fill={colors.merged} />
							{#if isLast || hoveredWeek === i}
								<text x={x0 + barW / 2} y={chart.top + plotH - (w.opened / max) * plotH - 4} text-anchor="middle" font-size="10" fill={colors.ink}>{w.opened}</text>
								<text x={x0 + barW + 2 + barW / 2} y={chart.top + plotH - (w.merged / max) * plotH - 4} text-anchor="middle" font-size="10" fill={colors.ink}>{w.merged}</text>
							{/if}
						</g>
						<text x={chart.left + i * groupW + groupW / 2} y={chart.height - 10} text-anchor="middle" font-size="10" fill={colors.muted}>{weekLabel(w.start)}</text>
						<!-- hit target wider than the bars -->
						<rect role="presentation" x={chart.left + i * groupW} y={chart.top} width={groupW} height={plotH + chart.bottom} fill="transparent" onmouseenter={() => (hoveredWeek = i)} />
					{/each}
					<line x1={chart.left} x2={chart.width - chart.right} y1={chart.top + plotH} y2={chart.top + plotH} stroke={colors.muted} stroke-width="1" />
				</svg>
				<details class="mt-2 text-xs" class:text-gray-600={!darkMode} class:text-gray-300={darkMode}>
					<summary class="cursor-pointer select-none">Show numbers</summary>
					<table class="mt-2 w-full tabular-nums">
						<thead>
							<tr class="text-left" class:text-gray-500={!darkMode} class:text-gray-400={darkMode}><th class="font-medium pr-3">Week of</th><th class="font-medium pr-3">Opened</th><th class="font-medium">Merged</th></tr>
						</thead>
						<tbody>
							{#each view.weeks as w (w.start)}
								<tr><td class="pr-3 py-0.5">{weekLabel(w.start)}</td><td class="pr-3">{w.opened}</td><td>{w.merged}</td></tr>
							{/each}
						</tbody>
					</table>
				</details>
			</div>

			<!-- Leaderboards -->
			<div class="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
				{#snippet board(title: string, seriesLabel: string, rows: { login: string; avatarUrl: string; primary: number; primaryLabel: string; secondary: string; weekly: number[] }[])}
					<div class="rounded-xl p-5 shadow-sm" class:bg-white={!darkMode} class:bg-slate-800={darkMode}>
						<h3 class="text-lg font-semibold mb-3" class:text-gray-800={!darkMode} class:text-white={darkMode}>{title} <span class="text-xs font-normal" class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>team · sparkline: {seriesLabel} per week</span></h3>
						<ol class="space-y-2">
							{#each rows as row, i (row.login)}
								<li class="flex items-center gap-3 text-sm">
									<span class="w-6 text-center">{row.primary > 0 && MEDALS[i] ? MEDALS[i] : `${i + 1}.`}</span>
									<img src={smallAvatar(row.avatarUrl)} alt="" class="w-7 h-7 rounded-full flex-shrink-0" loading="lazy" />
									<a
										href="https://github.com/{row.login}"
										target="_blank"
										rel="noopener noreferrer"
										class="truncate font-medium hover:underline"
										class:text-gray-800={!darkMode}
										class:text-gray-100={darkMode}
									>{row.login}</a>
									<svg viewBox="0 0 72 20" width="72" height="20" class="flex-shrink-0 ml-auto" aria-hidden="true">
										<title>{row.weekly.join(' · ')} {seriesLabel} per week</title>
										<polyline points={sparkline(row.weekly)} fill="none" stroke={colors.merged} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
										<circle cx="72" cy={20 - 2 - (row.weekly[row.weekly.length - 1] / Math.max(1, ...row.weekly)) * 16} r="2.5" fill={colors.merged} />
									</svg>
									<span class="whitespace-nowrap tabular-nums w-20 text-right" class:text-gray-700={!darkMode} class:text-gray-300={darkMode}>
										<strong>{row.primary}</strong> {row.primaryLabel}
									</span>
									<span class="whitespace-nowrap text-xs w-20 text-right" class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>{row.secondary}</span>
								</li>
							{/each}
						</ol>
					</div>
				{/snippet}

				{@render board('🔍 Top reviewers', 'PRs reviewed', view.reviewers.map((r) => ({
					login: r.login,
					avatarUrl: r.avatarUrl,
					primary: r.prsReviewed,
					primaryLabel: r.prsReviewed === 1 ? 'PR' : 'PRs',
					secondary: `${r.approvals} approved`,
					weekly: r.weekly
				})))}
				{@render board('🛠️ Top authors', 'PRs merged', view.authors.map((a) => ({
					login: a.login,
					avatarUrl: a.avatarUrl,
					primary: a.merged,
					primaryLabel: 'merged',
					secondary: `${a.opened} opened`,
					weekly: a.weekly
				})))}
			</div>

			{#if view.recentlyMerged.length > 0}
				<div class="mt-6 rounded-xl p-5 shadow-sm" class:bg-white={!darkMode} class:bg-slate-800={darkMode}>
					<h3 class="text-lg font-semibold mb-3" class:text-gray-800={!darkMode} class:text-white={darkMode}>✅ Recently merged</h3>
					<ul class="space-y-1.5 text-sm">
						{#each view.recentlyMerged as pr (pr.number)}
							<li class="flex gap-2 min-w-0">
								<a href={pr.url} target="_blank" rel="noopener noreferrer" class="font-mono flex-shrink-0 hover:underline" class:text-indigo-600={!darkMode} class:text-indigo-400={darkMode}>#{pr.number}</a>
								<span class="truncate" class:text-gray-700={!darkMode} class:text-gray-200={darkMode}>{pr.title}</span>
								<span class="ml-auto flex-shrink-0 text-xs" class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>{pr.author}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
		</div>
	{:else if status === 'loading'}
		<p class="text-center text-sm" class:text-gray-400={!darkMode} class:text-gray-500={darkMode}>Loading repo stats…</p>
	{/if}
</section>
