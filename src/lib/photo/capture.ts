import imageCompression from 'browser-image-compression';

export interface CompressionProgress {
	percent: number;
	usingMainThread: boolean;
}

/**
 * Detect if we should skip Web Workers entirely.
 * iOS Safari (especially older versions and PWAs) has unreliable Web Worker support.
 */
function shouldSkipWebWorker(): boolean {
	if (typeof navigator === 'undefined') return true;

	const ua = navigator.userAgent;
	const isIOS =
		/iPad|iPhone|iPod/.test(ua) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

	// Skip Web Workers on all iOS devices - too unreliable in Safari/PWA context
	if (isIOS) {
		console.log('[Photo] iOS detected, using main thread compression');
		return true;
	}

	return false;
}

/**
 * Compress an image file to ~2MB JPEG (high quality).
 * Strips EXIF metadata (GPS, timestamps) - app tracks its own metadata.
 *
 * Uses main thread on iOS (Web Workers unreliable), Web Worker elsewhere.
 *
 * @param file - Original image file from camera/file input
 * @param onProgress - Optional callback for compression progress
 * @returns Compressed Blob as JPEG
 */
export async function compressImage(
	file: File,
	onProgress?: (progress: CompressionProgress) => void
): Promise<Blob> {
	const useWebWorker = !shouldSkipWebWorker();

	console.log(
		`[Photo] Compressing ${(file.size / 1024 / 1024).toFixed(2)}MB image, useWebWorker: ${useWebWorker}`
	);

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

	return await imageCompression(file, options);
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
