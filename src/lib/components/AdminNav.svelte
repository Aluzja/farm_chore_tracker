<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { adminAuth } from '$lib/auth/admin.svelte';
	import { goto } from '$app/navigation';

	const navLinks = [
		{ href: '/', label: 'Today' },
		{ href: '/history', label: 'History' },
		{ href: '/admin/keys', label: 'Keys' },
		{ href: '/admin/chores', label: 'Chores' }
	] as const;

	function isActive(href: string, pathname: string): boolean {
		return href === '/' ? pathname === '/' : pathname.startsWith(href);
	}

	function handleSignOut() {
		adminAuth.signOut();
		goto(resolve('/admin/login'));
	}
</script>

{#if adminAuth.isAdmin}
	<header class="admin-header">
		<div class="admin-header-content">
			<nav class="admin-nav">
				{#each navLinks as { href, label } (href)}
					<a
						href={resolve(href)}
						class="admin-nav-link"
						class:active={isActive(href, page.url.pathname)}>{label}</a
					>
				{/each}
			</nav>
			<button onclick={handleSignOut} class="sign-out-btn" aria-label="Sign out">
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
		</div>
	</header>
{/if}

<style>
	.admin-header {
		background-color: white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		position: relative;
		z-index: 10;
	}

	.admin-header-content {
		max-width: 56rem;
		margin: 0 auto;
		padding: 0.75rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.admin-nav {
		display: flex;
		gap: 1.25rem;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.admin-nav::-webkit-scrollbar {
		display: none;
	}

	.admin-nav-link {
		font-size: 0.9375rem;
		font-weight: 500;
		color: #6b7280;
		text-decoration: none;
		padding: 0.5rem 0;
		border-bottom: 2px solid transparent;
		white-space: nowrap;
		transition:
			color 0.15s,
			border-color 0.15s;
	}

	.admin-nav-link:hover {
		color: #111827;
	}

	.admin-nav-link.active {
		color: #22c55e;
		border-bottom-color: #22c55e;
	}

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

	.sign-out-text {
		display: inline;
	}

	/* Mobile: icon only for sign out */
	@media (max-width: 640px) {
		.admin-header-content {
			padding: 0.5rem 1rem;
		}

		.admin-nav {
			gap: 1rem;
		}

		.admin-nav-link {
			font-size: 0.875rem;
		}

		.sign-out-text {
			display: none;
		}

		.sign-out-btn {
			padding: 0.5rem;
			min-width: 44px;
			min-height: 44px;
			justify-content: center;
		}
	}
</style>
