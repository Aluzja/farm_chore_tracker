import imageCompression from 'browser-image-compression';

export interface CompressionProgress {
	percent: number;
	usingMainThread: boolean;
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
	const isJpeg = file.type === 'image/jpeg';

	// Skip only if already a small JPEG — non-JPEG formats (HEIC, PNG)
	// must always be converted to ensure universal browser compatibility
	if (isJpeg && fileSizeMB <= 2) {
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
 * Draw an image source onto an OffscreenCanvas at thumbnail size and encode.
 * Tries WebP first, falls back to JPEG.
 */
async function drawThumbnail(
	source: ImageBitmap | HTMLImageElement,
	width: number,
	height: number
): Promise<Blob> {
	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext('2d')!;
	ctx.drawImage(source, 0, 0, width, height);

	try {
		return await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
	} catch {
		return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
	}
}

/**
 * Generate a small thumbnail (~10-30KB) for the chore list.
 * Primary path uses createImageBitmap (fast, no DOM needed).
 * Falls back to <img> + blob URL for formats createImageBitmap can't decode
 * (e.g. HEIC on browsers with native HEIC display support).
 * Returns undefined on failure — thumbnail is non-critical.
 */
export async function generateThumbnail(file: File | Blob): Promise<Blob | undefined> {
	// Primary: createImageBitmap (works directly with blobs, no data URL conversion)
	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(300 / bitmap.width, 300 / bitmap.height, 1);
		const result = await drawThumbnail(
			bitmap,
			Math.round(bitmap.width * scale),
			Math.round(bitmap.height * scale)
		);
		bitmap.close();
		return result;
	} catch {
		// createImageBitmap can't decode this format, try fallback
	}

	// Fallback: <img> element with blob URL (supports more formats on some platforms)
	try {
		const img = await loadImageFromBlob(file);
		const scale = Math.min(300 / img.naturalWidth, 300 / img.naturalHeight, 1);
		return await drawThumbnail(
			img,
			Math.round(img.naturalWidth * scale),
			Math.round(img.naturalHeight * scale)
		);
	} catch (error) {
		console.warn('[Photo] Thumbnail generation failed:', error);
		return undefined;
	}
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Image decode failed'));
		};
		img.src = url;
	});
}
