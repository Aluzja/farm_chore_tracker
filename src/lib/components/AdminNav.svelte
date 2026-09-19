<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { adminAuth } from '$lib/auth/admin.svelte';
	import { goto } from '$app/navigation';
	import SignOutButton from '$lib/components/SignOutButton.svelte';

	const navLinks = [
		{ href: '/', label: 'Today' },
		{ href: '/history', label: 'History' },
		{ href: '/admin/keys', label: 'Keys' },
		{ href: '/admin/chores', label: 'Chores' },
		{ href: '/admin/feed', label: 'Daily Total' }
	] as const;

	function isActive(href: string, pathname: string): boolean {
		return href === '/' ? pathname === '/' : pathname.startsWith(href);
	}

	function signOut() {
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
			<SignOutButton onconfirm={signOut} />
		</div>
	</header>
{/if}

<style>
	.admin-header {
		background-color: white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
	}
</style>
