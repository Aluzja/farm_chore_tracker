import { browser } from '$app/environment';

class ConnectionStatus {
	// Initialize with safe defaults that work during SSR
	isOnline = $state(true);
	lastOnlineAt = $state<number | null>(null);
	private initialized = false;

	// Call this from onMount to set up browser-only functionality
	init() {
		if (!browser || this.initialized) return;
		this.initialized = true;

		// Set actual values now that we're in browser
		this.isOnline = navigator.onLine;
		this.lastOnlineAt = navigator.onLine ? Date.now() : null;

		window.addEventListener('online', this.handleOnline);
		window.addEventListener('offline', this.handleOffline);
		document.addEventListener('visibilitychange', this.handleVisibility);
	}

	private handleOnline = () => {
		this.isOnline = true;
		this.lastOnlineAt = Date.now();
	};

	private handleOffline = () => {
		this.isOnline = false;
	};

	private handleVisibility = () => {
		// Trigger sync check when tab becomes visible
		if (document.visibilityState === 'visible' && this.isOnline) {
			this.lastOnlineAt = Date.now(); // Force reactivity update
		}
	};

	destroy() {
		if (browser) {
			window.removeEventListener('online', this.handleOnline);
			window.removeEventListener('offline', this.handleOffline);
			document.removeEventListener('visibilitychange', this.handleVisibility);
		}
		this.initialized = false;
	}
}

export const connectionStatus = new ConnectionStatus();
