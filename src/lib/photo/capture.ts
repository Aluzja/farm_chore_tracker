import imageCompression from 'browser-image-compression';

/**
 * Compress an image file to ~2MB JPEG (high quality).
 * Strips EXIF metadata (GPS, timestamps) - app tracks its own metadata.
 *
 * Falls back to main thread compression if Web Worker fails (older iOS devices).
 *
 * @param file - Original image file from camera/file input
 * @param onProgress - Optional callback for compression progress (0-100)
 * @returns Compressed Blob as JPEG
 */
export async function compressImage(
	file: File,
	onProgress?: (percent: number) => void
): Promise<Blob> {
	const baseOptions = {
		maxSizeMB: 2,
		preserveExif: false,
		fileType: 'image/jpeg' as const,
		initialQuality: 0.92,
		onProgress: onProgress
	};

	// Try with Web Worker first (faster, non-blocking)
	try {
		return await imageCompression(file, { ...baseOptions, useWebWorker: true });
	} catch (error) {
		console.warn('[Photo] Web Worker compression failed, falling back to main thread:', error);
	}

	// Fallback: compress on main thread (works on older iOS devices)
	return await imageCompression(file, { ...baseOptions, useWebWorker: false });
}

/**
 * Capture a photo from device camera.
 * Creates a hidden file input to trigger native camera.
 * Compresses the captured image before returning.
 *
 * @returns Object with compressed blob, preview URL, and original size, or null if cancelled
 */
export async function capturePhoto(): Promise<{
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
				// Compress the image
				const compressedBlob = await compressImage(file);

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
