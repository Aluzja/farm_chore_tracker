import { browser } from '$app/environment';

class ConnectionStatus {
	isOnline = $state(browser ? navigator.onLine : true);
	lastOnlineAt = $state<number | null>(browser && navigator.onLine ? Date.now() : null);

	constructor() {
		if (browser) {
			window.addEventListener('online', this.handleOnline);
			window.addEventListener('offline', this.handleOffline);
			// Also track visibility for sync triggers
			document.addEventListener('visibilitychange', this.handleVisibility);
		}
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
	}
}

export const connectionStatus = new ConnectionStatus();
