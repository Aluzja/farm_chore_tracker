import imageCompression from 'browser-image-compression';

export interface CompressionProgress {
	percent: number;
	usingMainThread: boolean;
}

// Timeout for Web Worker compression before falling back to main thread
const WEB_WORKER_TIMEOUT_MS = 5000;

/**
 * Run a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutError: Error): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => setTimeout(() => reject(timeoutError), ms))
	]);
}

/**
 * Compress an image file to ~2MB JPEG (high quality).
 * Strips EXIF metadata (GPS, timestamps) - app tracks its own metadata.
 *
 * Falls back to main thread compression if Web Worker fails or times out (older iOS devices).
 *
 * @param file - Original image file from camera/file input
 * @param onProgress - Optional callback for compression progress
 * @returns Compressed Blob as JPEG
 */
export async function compressImage(
	file: File,
	onProgress?: (progress: CompressionProgress) => void
): Promise<Blob> {
	let hasReceivedProgress = false;

	const makeOptions = (useWebWorker: boolean) => ({
		maxSizeMB: 2,
		preserveExif: false,
		fileType: 'image/jpeg' as const,
		initialQuality: 0.92,
		useWebWorker,
		onProgress: onProgress
			? (percent: number) => {
					hasReceivedProgress = true;
					onProgress({ percent, usingMainThread: !useWebWorker });
				}
			: undefined
	});

	// Try with Web Worker first (faster, non-blocking)
	// Use timeout because on some older iOS devices, Web Workers silently hang
	try {
		const webWorkerPromise = imageCompression(file, makeOptions(true));
		return await withTimeout(
			webWorkerPromise,
			WEB_WORKER_TIMEOUT_MS,
			new Error('Web Worker timeout')
		);
	} catch (error) {
		const reason = hasReceivedProgress ? 'failed' : 'timed out or not supported';
		console.warn(`[Photo] Web Worker compression ${reason}, falling back to main thread:`, error);
	}

	// Reset progress for fallback attempt
	onProgress?.({ percent: 0, usingMainThread: true });

	// Fallback: compress on main thread (works on older iOS devices)
	return await imageCompression(file, makeOptions(false));
}

/**
 * Capture a photo from device camera.
 * Creates a hidden file input to trigger native camera.
 * Compresses the captured image before returning.
 *
 * @param onProgress - Optional callback for compression progress updates
 * @returns Object with compressed blob, preview URL, and original size, or null if cancelled
 */
export async function capturePhoto(onProgress?: (progress: CompressionProgress) => void): Promise<{
	blob: Blob;
	previewUrl: string;
	originalSize: number;
} | null> {
	return new Promise((resolve, reject) => {
		// Create hidden file input
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.capture = 'environment'; // Prefer back camera

		// Handle file selection
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) {
				resolve(null);
				return;
			}

			// Capture original size before compression
			const originalSize = file.size;

			try {
				// Compress the image with progress tracking
				const compressedBlob = await compressImage(file, onProgress);

				// Create preview URL
				const previewUrl = URL.createObjectURL(compressedBlob);

				resolve({
					blob: compressedBlob,
					previewUrl,
					originalSize
				});
			} catch (error) {
				console.error('[Photo] Compression failed:', error);
				// Reject with error so UI can display it
				reject(error instanceof Error ? error : new Error('Failed to process photo'));
			}
		};

		// Handle cancel (input loses focus without selection)
		input.oncancel = () => {
			resolve(null);
		};

		// Trigger file picker / camera
		input.click();
	});
}
