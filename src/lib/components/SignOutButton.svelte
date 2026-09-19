<script lang="ts">
	let { onconfirm }: { onconfirm: () => void } = $props();

	let showConfirm = $state(false);

	function confirm() {
		showConfirm = false;
		onconfirm();
	}
</script>

<button onclick={() => (showConfirm = true)} class="sign-out-btn" aria-label="Sign out">
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
		<polyline points="16 17 21 12 16 7"></polyline>
		<line x1="21" y1="12" x2="9" y2="12"></line>
	</svg>
	<span class="sign-out-text">Sign Out</span>
</button>

{#if showConfirm}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onmousedown={() => (showConfirm = false)}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal" onmousedown={(e) => e.stopPropagation()}>
			<h2 class="modal-title">Sign out?</h2>
			<p class="modal-message">Are you sure you want to sign out?</p>
			<div class="modal-actions">
				<button class="modal-btn modal-btn-cancel" onclick={() => (showConfirm = false)}>
					Cancel
				</button>
				<button class="modal-btn modal-btn-confirm" onclick={confirm}>Sign Out</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.sign-out-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: #6b7280;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 0.375rem;
		flex-shrink: 0;
		transition:
			color 0.15s,
			background-color 0.15s;
	}

	.sign-out-btn:hover {
		color: #111827;
		background-color: #f3f4f6;
	}

	.sign-out-btn svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 1rem;
	}

	.modal {
		background: white;
		border-radius: 0.75rem;
		padding: 1.5rem;
		max-width: 20rem;
		width: 100%;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.modal-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: #111827;
		margin: 0 0 0.5rem 0;
	}

	.modal-message {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0 0 1.5rem 0;
		line-height: 1.5;
	}

	.modal-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
	}

	.modal-btn {
		padding: 0.5rem 1rem;
		min-height: 44px;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
	}

	.modal-btn-cancel {
		background: #f3f4f6;
		color: #374151;
	}

	.modal-btn-cancel:hover {
		background: #e5e7eb;
	}

	.modal-btn-confirm {
		background: #dc2626;
		color: white;
	}

	.modal-btn-confirm:hover {
		background: #b91c1c;
	}

	/* Mobile: icon only */
	@media (max-width: 640px) {
		.sign-out-text {
			display: none;
		}

		.sign-out-btn {
			min-width: 44px;
			min-height: 44px;
			justify-content: center;
		}
	}
</style>
