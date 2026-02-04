import imageCompression from 'browser-image-compression';

export interface CompressionProgress {
	percent: number;
	usingMainThread: boolean;
}

/**
 * Get iOS version from user agent, or null if not iOS.
 */
function getIOSVersion(): number | null {
	if (typeof navigator === 'undefined') return null;

	const ua = navigator.userAgent;

	// Check for iOS device
	const isIOS =
		/iPad|iPhone|iPod/.test(ua) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

	if (!isIOS) return null;

	// Extract version: "OS 15_8_6" or "OS 16_0"
	const match = ua.match(/OS (\d+)[_\d]*/);
	if (match) {
		return parseInt(match[1], 10);
	}

	return null;
}

/**
 * Detect if we should skip Web Workers.
 * iOS < 17 has unreliable OffscreenCanvas support in Web Workers.
 * browser-image-compression uses OffscreenCanvas for Web Worker compression.
 */
function shouldSkipWebWorker(): boolean {
	if (typeof navigator === 'undefined') return true;

	const iosVersion = getIOSVersion();

	if (iosVersion !== null) {
		// iOS 17+ has proper OffscreenCanvas support in Web Workers
		if (iosVersion >= 17) {
			console.log(`[Photo] iOS ${iosVersion} detected, using Web Worker`);
			return false;
		}
		console.log(
			`[Photo] iOS ${iosVersion} detected, using main thread (OffscreenCanvas unreliable)`
		);
		return true;
	}

	return false;
}

// Timeout for compression before giving up and using original
const COMPRESSION_TIMEOUT_MS = 30000;

/**
 * Run a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Compression timeout')), ms))
	]);
}

/**
 * Compress an image file to ~2MB JPEG (high quality).
 * Strips EXIF metadata (GPS, timestamps) - app tracks its own metadata.
 *
 * Uses main thread on iOS (Web Workers unreliable), Web Worker elsewhere.
 * Falls back to original file if compression fails or times out.
 *
 * @param file - Original image file from camera/file input
 * @param onProgress - Optional callback for compression progress
 * @returns Compressed Blob as JPEG, or original file if compression fails
 */
export async function compressImage(
	file: File,
	onProgress?: (progress: CompressionProgress) => void
): Promise<Blob> {
	const useWebWorker = !shouldSkipWebWorker();
	const fileSizeMB = file.size / 1024 / 1024;

	console.log(
		`[Photo] Compressing ${fileSizeMB.toFixed(2)}MB image, useWebWorker: ${useWebWorker}`
	);

	// If file is already small enough, skip compression
	if (fileSizeMB <= 2) {
		console.log('[Photo] File already under 2MB, skipping compression');
		onProgress?.({ percent: 100, usingMainThread: true });
		return file;
	}

	const options = {
		maxSizeMB: 2,
		preserveExif: false,
		fileType: 'image/jpeg' as const,
		initialQuality: 0.92,
		useWebWorker,
		onProgress: onProgress
			? (percent: number) => {
					onProgress({ percent, usingMainThread: !useWebWorker });
				}
			: undefined
	};

	try {
		return await withTimeout(imageCompression(file, options), COMPRESSION_TIMEOUT_MS);
	} catch (error) {
		console.warn('[Photo] Compression failed, using original file:', error);
		// Return original file as fallback
		return file;
	}
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
			console.log('[Photo] File input changed');

			const file = input.files?.[0];
			if (!file) {
				console.log('[Photo] No file selected');
				resolve(null);
				return;
			}

			console.log(
				`[Photo] File selected: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB, type: ${file.type}`
			);

			// Capture original size before compression
			const originalSize = file.size;

			try {
				console.log('[Photo] Starting compression...');
				// Compress the image with progress tracking
				const compressedBlob = await compressImage(file, onProgress);
				console.log(
					`[Photo] Compression complete: ${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB`
				);

				// Create preview URL
				const previewUrl = URL.createObjectURL(compressedBlob);
				console.log('[Photo] Preview URL created');

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
