import imageCompression from 'browser-image-compression';

export interface CompressionProgress {
	percent: number;
	usingMainThread: boolean;
}

// Timeout for compression before giving up and using original
const COMPRESSION_TIMEOUT_MS = 30000;

const THUMBNAIL_TIMEOUT_MS = 10000;

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
 * Uses Web Worker for non-blocking compression when available.
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
	const fileSizeMB = file.size / 1024 / 1024;

	// If file is already small enough, skip compression
	if (fileSizeMB <= 2) {
		onProgress?.({ percent: 100, usingMainThread: false });
		return file;
	}

	const options = {
		maxSizeMB: 2,
		preserveExif: false,
		fileType: 'image/jpeg' as const,
		initialQuality: 0.92,
		useWebWorker: true,
		onProgress: onProgress
			? (percent: number) => {
					onProgress({ percent, usingMainThread: false });
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
 * Generate a small thumbnail (~10-30KB) for the chore list.
 * Tries WebP first (smaller), falls back to JPEG if WebP encoding fails.
 * Returns undefined on failure — thumbnail is non-critical during capture.
 */
export async function generateThumbnail(file: File | Blob): Promise<Blob | undefined> {
	// browser-image-compression needs a File, convert Blob if needed
	// Default to image/jpeg if type is missing (e.g. blobs fetched from storage)
	const mimeType = file.type || 'image/jpeg';
	const inputFile =
		file instanceof File ? file : new File([file], 'photo.jpg', { type: mimeType });

	const baseOptions = {
		maxWidthOrHeight: 300,
		maxSizeMB: 0.05,
		preserveExif: false,
		initialQuality: 0.8,
		useWebWorker: true
	};

	// Try WebP first (~30% smaller)
	try {
		return await withTimeout(
			imageCompression(inputFile, { ...baseOptions, fileType: 'image/webp' as const }),
			THUMBNAIL_TIMEOUT_MS
		);
	} catch {
		// WebP encoding failed, try JPEG fallback
	}

	// Fallback to JPEG (universally compatible)
	try {
		return await withTimeout(
			imageCompression(inputFile, { ...baseOptions, fileType: 'image/jpeg' as const }),
			THUMBNAIL_TIMEOUT_MS
		);
	} catch (error) {
		console.warn('[Photo] Thumbnail generation failed:', error);
		return undefined;
	}
}
