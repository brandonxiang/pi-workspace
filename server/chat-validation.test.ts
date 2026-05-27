import { describe, expect, it } from "vitest";
import {
  getModelSupportsImages,
  getPromptOrDefault,
  maxImageBytes,
  parseImages
} from "./chat-validation.js";

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

describe("parseImages", () => {
  it("returns an empty list when no images are provided", () => {
    expect(parseImages(undefined)).toEqual([]);
  });

  it("normalizes a supported image attachment for Pi", () => {
    expect(
      parseImages([
        {
          mimeType: "image/png",
          size: 68,
          data: tinyPngBase64
        }
      ])
    ).toEqual([
      {
        type: "image",
        mimeType: "image/png",
        data: tinyPngBase64
      }
    ]);
  });

  it("rejects non-array image payloads", () => {
    expect(() => parseImages({ mimeType: "image/png", data: tinyPngBase64 })).toThrow(
      "images must be an array"
    );
  });

  it("rejects more than one image per message", () => {
    const image = { mimeType: "image/png", size: 68, data: tinyPngBase64 };

    expect(() => parseImages([image, image])).toThrow("Only 1 image can be uploaded per message");
  });

  it("rejects unsupported image types", () => {
    expect(() =>
      parseImages([{ mimeType: "image/svg+xml", size: 68, data: tinyPngBase64 }])
    ).toThrow("Unsupported image type");
  });

  it("rejects invalid base64 data", () => {
    expect(() => parseImages([{ mimeType: "image/png", size: 10, data: "not base64!" }])).toThrow(
      "Invalid image data"
    );
  });

  it("rejects oversized images by declared or encoded size", () => {
    const oversizedData = Buffer.alloc(maxImageBytes + 1).toString("base64");

    expect(() =>
      parseImages([{ mimeType: "image/png", size: maxImageBytes + 1, data: tinyPngBase64 }])
    ).toThrow("Image must be smaller than 5 MB");

    expect(() => parseImages([{ mimeType: "image/png", data: oversizedData }])).toThrow(
      "Image must be smaller than 5 MB"
    );
  });
});

describe("getModelSupportsImages", () => {
  it("detects models that support image input", () => {
    expect(getModelSupportsImages({ input: ["text", "image"] })).toBe(true);
    expect(getModelSupportsImages({ input: ["text"] })).toBe(false);
    expect(getModelSupportsImages({})).toBe(false);
  });
});

describe("getPromptOrDefault", () => {
  it("trims explicit prompt text", () => {
    expect(getPromptOrDefault("  analyze this  ", [])).toBe("analyze this");
  });

  it("uses an image analysis prompt when only an image is provided", () => {
    expect(
      getPromptOrDefault("", [{ type: "image", mimeType: "image/png", data: tinyPngBase64 }])
    ).toBe("Please analyze this image.");
  });

  it("returns an empty prompt when no text or image is provided", () => {
    expect(getPromptOrDefault(undefined, [])).toBe("");
  });
});
