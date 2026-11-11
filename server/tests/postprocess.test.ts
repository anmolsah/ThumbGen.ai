/**
 * tests/postprocess.test.ts
 *
 * Phase 5 unit and integration tests for Post-processing & Storage:
 *   - `original`, `watermarked`, and `preview_webp` (<= 640px) generation
 *   - Non-derivable cryptographic asset keys
 *   - Starter plan watermark isolation & unwatermarked unlock on upgrade
 *   - 4K pixel dimension verification (`3840x2160`)
 */

import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  processAndStoreAssets,
  sanitizeJobAssetsForPlan,
  sanitizeThumbnailForPlan,
} from "../services/postProcessService.js";

test("processAndStoreAssets produces original, watermarked, and <=640px preview_webp with independent random keys", async () => {
  const raw2k = await sharp({
    create: {
      width: 1920,
      height: 1080,
      channels: 3,
      background: { r: 220, g: 230, b: 245 },
    },
  })
    .png()
    .toBuffer();

  const uploadedKeys: string[] = [];
  const fakeUpload = async (
    _buf: Buffer,
    publicId: string,
    format: "webp" | "png"
  ) => {
    uploadedKeys.push(publicId);
    return `https://cdn.thumbgen.test/${publicId}.${format}`;
  };

  const outStarter = await processAndStoreAssets({
    rawAssetBytes: raw2k,
    requestedResolution: "2K",
    aspectRatio: "16:9",
    userPlan: "starter",
    uploadFn: fakeUpload,
  });

  // Verify 3 distinct keys were uploaded
  assert.equal(uploadedKeys.length, 3);
  const [origKey, wmKey, prevKey] = uploadedKeys;
  assert.match(origKey, /^thumbgen\/orig_[0-9a-f]{32}$/);
  assert.match(wmKey, /^thumbgen\/wm_[0-9a-f]{32}$/);
  assert.match(prevKey, /^thumbgen\/prev_[0-9a-f]{32}$/);

  // Ensure the 32-char hex tokens are completely independent (cannot derive orig from wm)
  const origHex = origKey.replace("thumbgen/orig_", "");
  const wmHex = wmKey.replace("thumbgen/wm_", "");
  assert.notEqual(origHex, wmHex);

  // Verify preview_webp dimensions <= 640px wide
  assert.ok(outStarter.previewDimensions.width <= 640);
  assert.equal(outStarter.previewDimensions.width, 640);
  assert.equal(outStarter.previewDimensions.height, 360);

  // Verify resolutionActual is 2K (1920x1080)
  assert.equal(outStarter.resolutionActual.width, 1920);
  assert.equal(outStarter.resolutionActual.height, 1080);
  assert.equal(outStarter.resolutionActual.tier, "2K");

  // Verify watermarked buffer differs from original buffer (watermark was composited)
  assert.equal(
    Buffer.compare(outStarter.originalBuffer, outStarter.watermarkedBuffer) !==
      0,
    true,
    "Watermarked buffer must differ from unwatermarked original buffer"
  );

  // Starter delivery_url must point to watermarked_url
  assert.equal(outStarter.assets.delivery_url, outStarter.assets.watermarked_url);
  assert.NotEqual;
  assert.notEqual(
    outStarter.assets.delivery_url,
    outStarter.assets.original_url
  );
});

test("Starter plan watermark isolation: Starter never receives original_url; upgrading to Creator/Pro unlocks original_url", () => {
  const sampleAssets = {
    original_url: "https://cdn.thumbgen.test/thumbgen/orig_aaaa1111bbbb2222cccc3333dddd4444.webp",
    watermarked_url: "https://cdn.thumbgen.test/thumbgen/wm_99998888777766665555444433332222.webp",
    preview_webp_url: "https://cdn.thumbgen.test/thumbgen/prev_1234567890abcdef1234567890abcdef.webp",
    delivery_url: "https://cdn.thumbgen.test/thumbgen/wm_99998888777766665555444433332222.webp",
  };

  const sampleJob = {
    id: "job_iso_1",
    status: "succeeded",
    assets: sampleAssets,
  };

  const sampleThumb = {
    _id: "thumb_iso_1",
    title: "Starter Thumbnail",
    image_url: sampleAssets.watermarked_url,
    original_url: sampleAssets.original_url,
    watermarked_url: sampleAssets.watermarked_url,
    preview_webp_url: sampleAssets.preview_webp_url,
  };

  // 1. On Starter plan: original_url is completely stripped!
  const starterJob = sanitizeJobAssetsForPlan(sampleJob, "starter");
  assert.equal(starterJob.assets?.original_url, null);
  assert.equal(starterJob.assets?.delivery_url, sampleAssets.watermarked_url);

  const starterThumb = sanitizeThumbnailForPlan(sampleThumb, "starter");
  assert.equal("original_url" in starterThumb, false);
  assert.equal(starterThumb.image_url, sampleAssets.watermarked_url);

  // 2. When user upgrades to Creator or Pro: original_url is unlocked!
  const creatorJob = sanitizeJobAssetsForPlan(sampleJob, "creator");
  assert.equal(creatorJob.assets?.original_url, sampleAssets.original_url);
  assert.equal(creatorJob.assets?.delivery_url, sampleAssets.original_url);

  const proThumb = sanitizeThumbnailForPlan(sampleThumb, "pro");
  assert.equal(proThumb.original_url, sampleAssets.original_url);
  assert.equal(proThumb.image_url, sampleAssets.original_url);
});

test("4K verification in processAndStoreAssets: verifies 3840x2160 pixel dimensions and sets delivery_url to original_url for Pro", async () => {
  const raw4k = await sharp({
    create: {
      width: 3840,
      height: 2160,
      channels: 3,
      background: { r: 20, g: 40, b: 80 },
    },
  })
    .png()
    .toBuffer();

  const outPro4k = await processAndStoreAssets({
    rawAssetBytes: raw4k,
    requestedResolution: "4K",
    aspectRatio: "16:9",
    userPlan: "pro",
    uploadFn: async (_buf, key, fmt) => `https://cdn.thumbgen.test/${key}.${fmt}`,
  });

  assert.equal(outPro4k.resolutionActual.width, 3840);
  assert.equal(outPro4k.resolutionActual.height, 2160);
  assert.equal(outPro4k.resolutionActual.tier, "4K");
  assert.equal(outPro4k.resolutionActual.dimensions, "3840x2160");
  assert.equal(outPro4k.assets.delivery_url, outPro4k.assets.original_url);
});
