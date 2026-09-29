import type { APIRoute } from 'astro';
import { v2 as cloudinary } from 'cloudinary';

export const prerender = false;

const base =
  "Restyle the person in [1] as a Día de Muertos-inspired fine-line tattoo portrait. " +
  "Preserve their identity, facial features, hairstyle, proportions, and recognizable expression. " +
  "Use crisp black ink on a pure white background with delicate tattoo-flash linework, " +
  "clean contours, restrained stippling, strong negative space, and clear details that print well at small size. " +
  "Use dignified ceremonial clothing inspired by traditional Mexican portraiture: an elegant embroidered blouse, " +
  "dress, rebozo, lace-trimmed neckline, or formal charro-inspired garment. " +
  "Avoid modern casual clothing, business attire, exposed cleavage, costume-like clothing, or generic fantasy garments. " +
  "Keep the face human and recognizable rather than replacing it with a skull. " +
  "No color, grayscale, gradients, painterly shading, beige texture, photorealism, text, or watermark.";

const stylePrompts = {
catrina:
  base +
  "Create a La Catrina-inspired portrait with symmetrical calavera makeup, floral eye ornamentation, " +
  "delicate cheek and forehead filigree, elegant lace details, and ornamental flowers framing the face. " +
  "The mood should be graceful, celebratory, dignified, and beautiful—not frightening.",
catrin:
  base +
  "Create an El Catrín-inspired portrait with refined calavera makeup, a formal embroidered charro-inspired jacket, " +
  "decorative collar or cravat, subtle folkloric details, and elegant floral framing. " +
  "The mood should be dignified, celebratory, and handsome—not scary or theatrical.",
golden:
  base +
  "Create a marigold-themed Día de Muertos portrait. " +
  "Place a clearly recognizable crown of cempasúchil marigolds on the person's head: " +
  "a substantial wreath or half-crown made of layered, ruffled marigold blossoms with leaves and stems. " +
  "Use the flowers as the main headpiece, not merely as scattered background flowers. " +
  "Represent golden warmth through radiating petals, sun motifs, and ornamental rays in black linework only. " +
  "The clothing should be an elegant embroidered ceremonial blouse, dress, or rebozo.",
night:
  base +
  "Create a fuller La Llorona-inspired Día de Muertos portrait. " +
  "Show the person from the head through the upper torso, surrounded by a large flowing veil or rebozo " +
  "that expands through the composition like water and wind. " +
  "Add a solemn, mournful expression, delicate tear-shaped droplets, trailing fabric, water ripples, " +
  "a crescent moon, sparse stars, and ghostly floral details. " +
  "Use a dignified ceremonial Mexican-inspired dress beneath the veil. " +
  "Represent night symbolically with moon, stars, candles, and water—not with color, darkness, glow, or gradients. " +
  "The result should feel haunting, poetic, and beautiful, not gory, demonic, or frightening."
} as const;

type GenerationResponse = {
	data?: {
		assets?: Array<{
			storage?: { secure_url?: string };
		}>;
	};
	error?: { message?: string };
};

function json(body: Record<string, string>, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
	});
}

function getCloudinaryCredentials() {
	const env = import.meta.env.DEV
		? {
			CLOUDINARY_URL: import.meta.env.CLOUDINARY_URL,
			CLOUDINARY_CLOUD_NAME: import.meta.env.CLOUDINARY_CLOUD_NAME,
			CLOUDINARY_API_KEY: import.meta.env.CLOUDINARY_API_KEY,
			CLOUDINARY_API_SECRET: import.meta.env.CLOUDINARY_API_SECRET,
		}
		: process.env;
	let connection: URL | undefined;
	try {
		const cloudinaryUrl = env.CLOUDINARY_URL;
		if (cloudinaryUrl) connection = new URL(cloudinaryUrl);
	} catch {
		return undefined;
	}

	if (connection && connection.protocol !== 'cloudinary:') return undefined;
	return {
		cloudName: env.CLOUDINARY_CLOUD_NAME || connection?.hostname,
		apiKey: env.CLOUDINARY_API_KEY || (connection ? decodeURIComponent(connection.username) : undefined),
		apiSecret: env.CLOUDINARY_API_SECRET || (connection ? decodeURIComponent(connection.password) : undefined),
	};
}

export const POST: APIRoute = async ({ request }) => {
	const credentials = getCloudinaryCredentials();
	if (!credentials?.cloudName || !credentials.apiKey || !credentials.apiSecret) {
		return json({ error: 'Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your local .env file.' }, 503);
	}
	const { cloudName, apiKey, apiSecret } = credentials;

	let sourcePublicId: string | undefined;
	try {
		const form = await request.formData();
		const photo = form.get('photo');
		const style = form.get('style');
		if (!(photo instanceof File) || !photo.type.startsWith('image/')) {
			return json({ error: 'Choose an image file to create your portrait.' }, 400);
		}
		if (photo.size === 0 || photo.size > 12 * 1024 * 1024) {
			return json({ error: 'Choose an image smaller than 12 MB.' }, 400);
		}
		if (typeof style !== 'string' || !Object.hasOwn(stylePrompts, style)) {
			return json({ error: 'Choose one of the available portrait styles.' }, 400);
		}

		cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
		const fileBytes = Buffer.from(await photo.arrayBuffer());
		const upload = await new Promise<{ asset_id: string; public_id: string }>((resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream({ folder: 'calavera-cabina', resource_type: 'image' }, (error, result) => {
				if (error || !result?.asset_id || !result.public_id) {
					reject(error ?? new Error('Cloudinary did not return the uploaded image.'));
					return;
				}
				resolve({ asset_id: result.asset_id, public_id: result.public_id });
			});
			stream.end(fileBytes);
		});
		sourcePublicId = upload.public_id;

		const endpoint = `https://api.cloudinary.com/v2/generate/${encodeURIComponent(cloudName)}/image_to_image`;
		const authorization = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${authorization}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				prompt: stylePrompts[style as keyof typeof stylePrompts],
				reference_images: [{ source_type: 'managed_asset', asset_id: upload.asset_id }],
				model: { mode: 'auto', preference: 'quality' },
				image_size: { aspect_ratio: '3:4', resolution: '1K' },
				target: {
					target_type: 'managed_asset',
					public_id: `calavera-cabina/portraits/${crypto.randomUUID()}`,
				},
			}),
		});
		const result = await response.json() as GenerationResponse;
		const secureUrl = result.data?.assets?.[0]?.storage?.secure_url;
		if (!response.ok || !secureUrl) {
			return json({ error: result.error?.message ?? 'Cloudinary could not generate your portrait. Check that the Image Generation add-on is enabled.' }, 502);
		}
		return json({ secureUrl });
	} catch {
		return json({ error: 'Something went wrong while creating your portrait. Check your Cloudinary setup and try again.' }, 502);
	} finally {
		if (sourcePublicId) {
			try {
				await cloudinary.uploader.destroy(sourcePublicId, { resource_type: 'image', invalidate: true });
			} catch {
				// Source cleanup is best-effort if Cloudinary is temporarily unavailable.
			}
		}
	}
};