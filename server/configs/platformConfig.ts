export interface PlatformSpec {
  aspectRatio: string;
  width: number;
  height: number;
  promptHint: string;
}

export const PLATFORM_CONFIG: Record<string, PlatformSpec> = {
  youtube: {
    aspectRatio: "16:9",
    width: 1280,
    height: 720,
    promptHint:
      "Bold, eye-catching, high contrast. Large text overlay friendly. Expressive faces if applicable. Designed for 16:9 video thumbnail.",
  },
  "youtube-shorts": {
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    promptHint:
      "Vertical format, bold and vibrant. Designed for YouTube Shorts cover. Eye-catching at small sizes.",
  },
  "instagram-post": {
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    promptHint:
      "Clean, aesthetic, Instagram-worthy. Vibrant or muted tones depending on niche. Designed for square feed format.",
  },
  "instagram-portrait": {
    aspectRatio: "4:5",
    width: 1080,
    height: 1350,
    promptHint:
      "Clean, aesthetic, Instagram-worthy. Portrait orientation, takes up maximum feed space. Designed for 4:5 portrait feed format.",
  },
  "instagram-story": {
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    promptHint:
      "Vertical format, full-bleed design. Bold text at center, avoid top/bottom edges (UI overlaps). Story/Reel optimized.",
  },
  tiktok: {
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    promptHint:
      "Vertical format, bold and trendy. Eye-catching at small sizes. Avoid text in top 15% and bottom 20% (UI overlaps).",
  },
  twitter: {
    aspectRatio: "16:9",
    width: 1200,
    height: 675,
    promptHint:
      "Clean, newsworthy composition. Works well at small preview size. Horizontal format. Minimal text overlay.",
  },
  linkedin: {
    aspectRatio: "1.91:1",
    width: 1200,
    height: 627,
    promptHint:
      "Professional, polished, corporate-friendly. Clean typography. Horizontal format. Appropriate for business audience.",
  },
  facebook: {
    aspectRatio: "1.91:1",
    width: 1200,
    height: 630,
    promptHint:
      "Engaging, shareable composition. Works at multiple preview sizes. Horizontal format. Broad audience appeal.",
  },
  pinterest: {
    aspectRatio: "2:3",
    width: 1000,
    height: 1500,
    promptHint:
      "Tall, vertical format. Text overlay friendly. Lifestyle/aspirational aesthetic. Designed to stop the scroll in a feed.",
  },
};

export const SUPPORTED_PLATFORMS = Object.keys(PLATFORM_CONFIG);

export const SUPPORTED_ASPECT_RATIOS = [
  "16:9",
  "1:1",
  "9:16",
  "4:3",
  "3:4",
  "4:5",
  "3:2",
  "2:3",
  "2:1",
  "1:2",
  "1.91:1",
];
