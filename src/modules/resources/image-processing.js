import sharp from "sharp";

// Public display imagery is normalized to a compact, metadata-free format. The
// resize limit preserves aspect ratio and never enlarges a small source image.
export const normalizePublicImage = async (buffer) =>
  sharp(buffer, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
