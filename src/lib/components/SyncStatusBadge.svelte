<script lang="ts">
	type SyncStatus = 'pending' | 'synced' | 'failed';

	interface Props {
		status: SyncStatus;
	}

	const { status }: Props = $props();

	// Accessibility labels for each status
	const ariaLabels: Record<SyncStatus, string> = {
		pending: 'Pending sync',
		synced: 'Synced',
		failed: 'Sync failed'
	};
</script>

<span
	class="sync-indicator sync-indicator--{status}"
	aria-label={ariaLabels[status]}
	role="status"
>
	{#if status === 'pending'}
		<span class="sync-dot"></span>
	{:else if status === 'failed'}
		<span class="sync-alert">!</span>
	{/if}
</span>

<style>
	.sync-indicator {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		/* 44px minimum touch target for potential future tap-to-retry */
		min-width: 44px;
		min-height: 44px;
		flex-shrink: 0;
	}

	/* Pending: Pulsing amber dot with delay to avoid flash on quick syncs */
	.sync-indicator--pending .sync-dot {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 50%;
		background: #f59e0b;
		/* Start hidden, then fade in after 500ms delay */
		opacity: 0;
		animation: delayedPulse 1.5s ease-in-out infinite;
		animation-delay: 500ms;
		animation-fill-mode: backwards;
	}

	@keyframes delayedPulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(0.85);
		}
	}

	/* Synced: Hidden (no visual noise when everything is synced) */
	.sync-indicator--synced {
		opacity: 0;
		pointer-events: none;
	}

	/* Failed: Red exclamation mark, always visible */
	.sync-indicator--failed .sync-alert {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		background: #fef2f2;
		color: #dc2626;
		font-weight: 700;
		font-size: 0.875rem;
		line-height: 1;
	}
</style>
