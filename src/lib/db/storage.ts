import { browser } from '$app/environment';

export async function requestPersistentStorage(): Promise<boolean> {
	if (!browser || !navigator.storage?.persist) {
		console.warn('[Storage] Persistent storage API not available');
		return false;
	}

	const isPersisted = await navigator.storage.persisted();
	if (isPersisted) {
		return true;
	}

	const granted = await navigator.storage.persist();
	if (granted) {
		console.log('[Storage] Persistent storage granted');
	} else {
		console.warn('[Storage] Persistent storage denied - data may be evicted');
	}
	return granted;
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
	if (!browser || !navigator.storage?.estimate) {
		return { usage: 0, quota: 0 };
	}
	const { usage = 0, quota = 0 } = await navigator.storage.estimate();
	return { usage, quota };
}

export function formatStorageSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
