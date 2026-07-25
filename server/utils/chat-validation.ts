export const supportedImageMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
export const maxImageBytes = 5 * 1024 * 1024;
export const maxImagesPerMessage = 1;

export interface ChatImage {
  name?: string;
  mimeType?: string;
  data?: string;
  size?: number;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export function getModelSupportsImages(model: { input?: string[] }) {
  return Array.isArray(model.input) && model.input.includes("image");
}

export function getPromptOrDefault(prompt: string | undefined, images: ImageContent[]) {
  return prompt?.trim() || (images.length > 0 ? "Please analyze this image." : "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(value: unknown, key: string) {
  return isRecord(value) && typeof value[key] === "string" ? value[key] : undefined;
}

export function parseImages(value: unknown): ImageContent[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error("images must be an array");
  }
  if (value.length > maxImagesPerMessage) {
    throw new Error(`Only ${maxImagesPerMessage} image can be uploaded per message`);
  }

  return value.map((image) => {
    if (!isRecord(image)) throw new Error("Invalid image attachment");

    const mimeType = readStringField(image, "mimeType");
    const data = readStringField(image, "data");
    const size = typeof image.size === "number" ? image.size : undefined;

    if (
      !mimeType ||
      !supportedImageMimeTypes.includes(mimeType as (typeof supportedImageMimeTypes)[number])
    ) {
      throw new Error("Unsupported image type. Upload PNG, JPEG, WebP, or GIF.");
    }
    if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      throw new Error("Invalid image data");
    }

    const byteLength = Buffer.byteLength(data, "base64");
    if (byteLength === 0 || byteLength > maxImageBytes) {
      throw new Error("Image must be smaller than 5 MB");
    }
    if (size && size > maxImageBytes) {
      throw new Error("Image must be smaller than 5 MB");
    }

    return {
      type: "image",
      mimeType,
      data,
    };
  });
}
