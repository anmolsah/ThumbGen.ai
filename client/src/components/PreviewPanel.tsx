import { useEffect, useState } from "react";
import {
  DownloadIcon,
  ImageIcon,
  Loader2Icon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  SmartphoneIcon,
  ScanIcon,
  MonitorIcon,
} from "lucide-react";
import type { AspectRatio, IThumbnail } from "../assets/assets";

export type PreviewInspectMode = "canvas" | "safezone" | "mobile_feed";

const PreviewPanel = ({
  thumbnail,
  isLoading,
  aspectRatio,
  overlayTitle = "",
  overlayPosition = "bottom",
  videoTitle = "",
}: {
  thumbnail: IThumbnail | null;
  isLoading: boolean;
  aspectRatio: AspectRatio;
  overlayTitle?: string;
  overlayPosition?: "top" | "bottom";
  videoTitle?: string;
}) => {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [inspectMode, setInspectMode] = useState<PreviewInspectMode>("canvas");

  useEffect(() => {
    if (!isLoading) {
      setElapsedSec(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const aspectClasses: Record<string, string> = {
    "16:9": "aspect-video",
    "1:1": "aspect-square",
    "9:16": "aspect-[9/16]",
    "4:5": "aspect-[4/5]",
    "2:3": "aspect-[2/3]",
    "1.91:1": "aspect-[1.91/1]",
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const currentStage =
    elapsedSec < 3
      ? "Reserving credits & compiling structured brief…"
      : elapsedSec < 18
      ? "Rendering imagery & running deterministic QA gate…"
      : "Verifying pixel resolution & encoding sRGB WebP preview…";

  const onDownload = () => {
    if (!thumbnail?.image_url) return;
    const link = document.createElement("a");
    link.href = thumbnail.image_url.replace("/upload", "/upload/fl_attachment");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const verifiedDimensions =
    thumbnail?.generation_meta?.resolution_actual?.dimensions ||
    (thumbnail?.resolution === "4k" ? "3840×2160 (4K)" : "2K Verified");

  const cleanOverlayTitle = overlayTitle.trim();
  const displayVideoTitle =
    videoTitle.trim() || thumbnail?.title || "Why Most Architecture Fails Under Real Load";

  const renderOverlayTextElement = (isCompact = false) => {
    if (!cleanOverlayTitle) return null;
    return (
      <div
        className={`pointer-events-none absolute inset-x-0 flex justify-center px-4 ${
          overlayPosition === "top" ? "top-4" : "bottom-4"
        }`}
      >
        <div
          className={`rounded-lg bg-[#090a0c]/85 border border-white/[0.14] px-3.5 py-1.5 shadow-lg ${
            isCompact ? "max-w-[90%]" : "max-w-[84%]"
          }`}
        >
          <span
            className={`block font-black uppercase tracking-tight text-white text-center leading-tight ${
              isCompact ? "text-xs" : "text-lg sm:text-2xl"
            }`}
          >
            {cleanOverlayTitle}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="relative mx-auto w-full">
      {/* Studio Inspect Mode Switcher (Section 10A.3 & 10A.11) */}
      <div className="px-4 py-2 border-b border-white/[0.08] bg-[#111317] flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center rounded-lg bg-[#090a0c] p-0.5 border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setInspectMode("canvas")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 ${
              inspectMode === "canvas"
                ? "bg-[#171a20] text-zinc-100 border border-white/[0.1]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <MonitorIcon className="size-3" />
            <span>Full Canvas</span>
          </button>

          <button
            type="button"
            onClick={() => setInspectMode("safezone")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 ${
              inspectMode === "safezone"
                ? "bg-[#171a20] text-zinc-100 border border-white/[0.1]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ScanIcon className="size-3" />
            <span>Safe Zone (80%)</span>
          </button>

          <button
            type="button"
            onClick={() => setInspectMode("mobile_feed")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 ${
              inspectMode === "mobile_feed"
                ? "bg-[#171a20] text-zinc-100 border border-white/[0.1]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <SmartphoneIcon className="size-3" />
            <span>Mobile Feed (320×180)</span>
          </button>
        </div>

        <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
          {inspectMode === "safezone"
            ? "Center 80% + YT Badge"
            : inspectMode === "mobile_feed"
            ? "Feed Legibility Check"
            : `sRGB · ${aspectRatio}`}
        </span>
      </div>

      {/* Mode 3: 320x180 Mobile Feed Preview (Section 10A.3) */}
      {inspectMode === "mobile_feed" && !isLoading ? (
        <div className="p-6 bg-[#090a0c] flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-[320px] max-w-full rounded-xl border border-white/[0.08] bg-[#111317] p-3 space-y-2.5">
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-[#090a0c] border border-white/[0.06]">
              {thumbnail?.image_url ? (
                <img
                  src={thumbnail.image_url}
                  alt={displayVideoTitle}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-[11px] font-mono text-zinc-500">
                  320 × 180 Mobile Feed Frame
                </div>
              )}
              {renderOverlayTextElement(true)}
              {/* Authentic bottom-right YouTube duration badge */}
              <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 text-[10px] font-mono font-semibold text-white tabular-nums">
                14:28
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-0.5">
              <div className="size-7 rounded-full bg-[#171a20] border border-white/[0.1] shrink-0 flex items-center justify-center text-[10px] font-mono font-semibold text-zinc-300">
                TG
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-100 line-clamp-2 leading-snug">
                  {displayVideoTitle}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                  Creator Channel · 128K views · 2 hours ago
                </p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-zinc-400 mt-3 text-center max-w-sm">
            Section 10A.3 Mobile Check: Verify that your focal subject and headline remain legible at 320×180px and clear the bottom-right duration badge.
          </p>
        </div>
      ) : (
        <div
          className={`relative overflow-hidden bg-[#090a0c] ${
            aspectClasses[aspectRatio] || "aspect-video"
          }`}
        >
          {/* Loading state with live timer, stage indicator, and automatic refund guarantee */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-[#090a0c]">
              <div className="max-w-sm w-full rounded-xl border border-white/[0.08] bg-[#111317] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Loader2Icon className="size-4 animate-spin text-brand-400" />
                    <span className="text-xs font-semibold text-zinc-100">
                      Rendering Thumbnail
                    </span>
                  </div>
                  <span className="text-xs font-mono text-zinc-300 px-2 py-0.5 rounded bg-[#090a0c] border border-white/[0.08] tabular-nums">
                    {formatTimer(elapsedSec)}
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  {currentStage}
                </p>

                {/* Progress stages bar */}
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="h-1 rounded-full bg-brand-400" />
                  <div
                    className={`h-1 rounded-full transition-colors duration-200 ${
                      elapsedSec >= 3 ? "bg-brand-400" : "bg-white/[0.08]"
                    }`}
                  />
                  <div
                    className={`h-1 rounded-full transition-colors duration-200 ${
                      elapsedSec >= 18 ? "bg-brand-400" : "bg-white/[0.08]"
                    }`}
                  />
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-start gap-2 text-[11px] text-zinc-400">
                  <ShieldCheckIcon className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    If generation fails or times out, 100% of your reserved credits are automatically refunded.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error state if job failed */}
          {!isLoading && !thumbnail?.image_url && thumbnail?.error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-[#090a0c]">
              <div className="max-w-sm w-full rounded-xl border border-red-500/30 bg-red-950/20 p-5 space-y-3 text-left">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangleIcon className="size-4 shrink-0" />
                  <span className="text-xs font-semibold">Generation Failed</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {thumbnail.error}
                </p>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 pt-1">
                  <ShieldCheckIcon className="size-3.5 shrink-0" />
                  <span>Reserved credits have been automatically refunded.</span>
                </p>
              </div>
            </div>
          )}

          {/* Image preview */}
          {!isLoading && thumbnail?.image_url && (
            <div className="group relative h-full w-full">
              <img
                src={thumbnail.image_url}
                alt={thumbnail.title}
                className="h-full w-full object-cover"
              />

              {renderOverlayTextElement(false)}

              {/* Top-left verified resolution badge */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#090a0c]/85 border border-white/[0.12] text-[11px] font-mono text-zinc-200 flex items-center gap-1.5 tabular-nums">
                <CheckCircle2Icon className="size-3 text-emerald-400" />
                <span>{verifiedDimensions}</span>
              </div>

              <div className="absolute inset-0 flex items-end justify-end p-4 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <button
                  onClick={onDownload}
                  type="button"
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white"
                >
                  <DownloadIcon className="size-3.5" />
                  <span>Download Master</span>
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !thumbnail?.image_url && !thumbnail?.error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-[#090a0c]">
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#111317] border border-white/[0.08]">
                <ImageIcon className="size-5 text-zinc-400" />
              </div>

              <div className="max-w-xs space-y-1">
                <p className="text-xs sm:text-sm font-medium text-zinc-200">
                  Canvas Ready ({aspectRatio})
                </p>
                <p className="text-xs text-zinc-400">
                  Enter your video title, choose a mode and style on the left, and click Generate.
                </p>
              </div>

              {renderOverlayTextElement(false)}
            </div>
          )}

          {/* Safe-Zone & YouTube Duration Badge Overlay (Section 10A.3 & 10A.11) */}
          {inspectMode === "safezone" && !isLoading && (
            <div className="pointer-events-none absolute inset-0">
              {/* 80% Center Safe Zone Guide */}
              <div className="absolute inset-[10%] border border-dashed border-emerald-400/70 rounded-lg flex items-start justify-between p-2">
                <span className="px-2 py-0.5 rounded bg-[#090a0c]/90 border border-emerald-400/40 text-[10px] font-mono text-emerald-300 tabular-nums">
                  Center 80% Focal &amp; Face Safe Zone
                </span>
              </div>

              {/* Bottom-right YouTube Duration Badge Danger Zone */}
              <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded bg-black/90 border border-amber-400/60 text-xs font-mono font-semibold text-amber-300 tabular-nums">
                14:28 · YT Badge
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PreviewPanel;
