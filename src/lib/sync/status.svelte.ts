import { browser } from '$app/environment';

class ConnectionStatus {
	// Initialize with safe defaults that work during SSR
	isOnline = $state(true);
	lastOnlineAt = $state<number | null>(null);
	updateAvailable = $state(false);
	private initialized = false;
	private updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
	private updateCheckInterval: ReturnType<typeof setInterval> | null = null;
	private registration: ServiceWorkerRegistration | null = null;

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

	// Register the service worker update function
	setUpdateSW(updateSW: (reloadPage?: boolean) => Promise<void>) {
		this.updateSW = updateSW;
	}

	// Called when a new service worker is waiting to activate
	notifyUpdateAvailable() {
		this.updateAvailable = true;
	}

	// Apply the update: activate new SW and reload
	applyUpdate() {
		if (this.updateSW) {
			this.updateSW(true);
		}
	}

	// Start periodic update checks
	startUpdateChecks(registration: ServiceWorkerRegistration) {
		this.registration = registration;

		// Check immediately, then every 60 seconds
		this.checkForUpdate();
		this.updateCheckInterval = setInterval(() => {
			if (this.isOnline) {
				this.checkForUpdate();
			}
		}, 60_000);
	}

	private checkForUpdate() {
		this.registration?.update().catch(() => {
			// Silently ignore update check failures
		});
	}

	private handleOnline = () => {
		this.isOnline = true;
		this.lastOnlineAt = Date.now();
	};

	private handleOffline = () => {
		this.isOnline = false;
	};

	private handleVisibility = () => {
		if (document.visibilityState === 'visible') {
			if (this.isOnline) {
				this.lastOnlineAt = Date.now();
				// Check for app updates when resuming from background
				this.checkForUpdate();
			}
		}
	};

	destroy() {
		if (browser) {
			window.removeEventListener('online', this.handleOnline);
			window.removeEventListener('offline', this.handleOffline);
			document.removeEventListener('visibilitychange', this.handleVisibility);
			if (this.updateCheckInterval) {
				clearInterval(this.updateCheckInterval);
				this.updateCheckInterval = null;
			}
		}
		this.initialized = false;
	}
}

export const connectionStatus = new ConnectionStatus();
