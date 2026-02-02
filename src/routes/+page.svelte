<script lang="ts">
	import { useQuery } from 'convex-svelte';
	import { api } from '../convex/_generated/api';

	const tasks = useQuery(api.tasks.list, {});
</script>

<main>
	<h1>Kitchen Sink Farm</h1>

	<section>
		<h2>Foundation Status</h2>

		<div class="status-card">
			<h3>PWA</h3>
			<p>Check browser DevTools > Application > Service Workers</p>
			<p>Service worker should be registered and active.</p>
		</div>

		<div class="status-card">
			<h3>Convex Connection</h3>
			{#if tasks.isLoading}
				<p class="loading">Connecting to Convex...</p>
			{:else if tasks.error}
				<p class="error">Error: {tasks.error.message}</p>
			{:else}
				<p class="success">Connected! Real-time sync active.</p>
				<p>Tasks in database: {tasks.data?.length ?? 0}</p>
				<p class="hint">Add tasks via Convex Dashboard to see real-time updates.</p>
			{/if}
		</div>
	</section>

	<section>
		<h2>Phase 1 Checklist</h2>
		<ul>
			<li>PWA installable on mobile (check Add to Home Screen)</li>
			<li>Service worker caches app shell</li>
			<li>Convex WebSocket connects without errors</li>
			<li>Real-time updates work (add task in Dashboard)</li>
		</ul>
	</section>
</main>

<style>
	main {
		max-width: 600px;
		margin: 0 auto;
		padding: 2rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	h1 {
		color: #4caf50;
	}

	.status-card {
		background: #f5f5f5;
		border-radius: 8px;
		padding: 1rem;
		margin: 1rem 0;
	}

	.status-card h3 {
		margin-top: 0;
	}

	.loading {
		color: #666;
	}

	.error {
		color: #d32f2f;
	}

	.success {
		color: #4caf50;
		font-weight: bold;
	}

	.hint {
		font-size: 0.9rem;
		color: #666;
		font-style: italic;
	}

	ul {
		line-height: 1.8;
	}
</style>
