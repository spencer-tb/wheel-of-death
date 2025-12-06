<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>🪦 Wheel of Death 🪦</title>
	<meta name="description" content="Spin the wheel... if you dare" />
</svelte:head>

<div class="min-h-screen flex flex-col">
	{@render children()}
</div>
