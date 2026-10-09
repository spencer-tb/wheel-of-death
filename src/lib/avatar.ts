// Participant pictures are stored inline as JPEG data URLs so a saved
// wheel stays a single KV value and share links keep working. They fill a
// whole slice, so keep enough pixels to look sharp on a large wheel.
export const AVATAR_SIZE = 256;
export const AVATAR_JPEG_QUALITY = 0.85;
export const MAX_AVATAR_DATA_URL_LENGTH = 80_000;

const AVATAR_DATA_URL_PATTERN = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/;

export function isValidAvatarDataUrl(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length <= MAX_AVATAR_DATA_URL_LENGTH &&
		AVATAR_DATA_URL_PATTERN.test(value)
	);
}

// Pictures that ship with the app under static/avengers
const PRESET_IMAGE_PATTERN = /^\/avengers\/[a-z-]+\.webp$/;

export function isValidParticipantImage(value: unknown): value is string {
	return (
		isValidAvatarDataUrl(value) ||
		(typeof value === 'string' && PRESET_IMAGE_PATTERN.test(value))
	);
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
	if (typeof createImageBitmap === 'function') {
		try {
			// from-image applies the EXIF rotation that phone photos rely on
			return await createImageBitmap(file, { imageOrientation: 'from-image' });
		} catch {
			// Older browsers reject the options bag; fall back to <img>
		}
	}
	const url = URL.createObjectURL(file);
	try {
		return await new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('Could not read that image'));
			img.src = url;
		});
	} finally {
		URL.revokeObjectURL(url);
	}
}

// Crop the picture to a centred square, shrink it to AVATAR_SIZE and encode
// it as a JPEG data URL small enough to pass isValidAvatarDataUrl.
export async function fileToAvatarDataUrl(file: File): Promise<string> {
	if (!file.type.startsWith('image/')) {
		throw new Error('Please choose an image file');
	}

	const source = await decodeImage(file);
	const side = Math.min(source.width, source.height);
	const sx = (source.width - side) / 2;
	const sy = (source.height - side) / 2;

	const canvas = document.createElement('canvas');
	canvas.width = AVATAR_SIZE;
	canvas.height = AVATAR_SIZE;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Could not process that image');

	// JPEG has no alpha, so give transparent pictures a white backdrop
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(source, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
	if (source instanceof ImageBitmap) source.close();

	let quality = AVATAR_JPEG_QUALITY;
	let dataUrl = canvas.toDataURL('image/jpeg', quality);
	while (dataUrl.length > MAX_AVATAR_DATA_URL_LENGTH && quality > 0.3) {
		quality -= 0.1;
		dataUrl = canvas.toDataURL('image/jpeg', quality);
	}
	if (!isValidAvatarDataUrl(dataUrl)) {
		throw new Error('That image is too detailed to shrink');
	}
	return dataUrl;
}
