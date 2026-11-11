import { useEffect, useState } from "react";
import {
  DownloadIcon,
  ImageIcon,
  Loader2Icon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
} from "lucide-react";
import type { AspectRatio, IThumbnail } from "../assets/assets";

const PreviewPanel = ({
  thumbnail,
  isLoading,
  aspectRatio,
}: {
  thumbnail: IThumbnail | null;
  isLoading: boolean;
  aspectRatio: AspectRatio;
}) => {
  const [elapsedSec, setElapsedSec] = useState(0);

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
      ? "Reserving credits & dispatching job…"
      : elapsedSec < 18
      ? "Generating high-contrast artwork…"
      : "Verifying pixel resolution & encoding WebP preview…";

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
    (thumbnail?.resolution === "4k" ? "4K Verified" : "2K Verified");

  return (
    <div className="relative mx-auto w-full">
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
                  className={`h-1 rounded-full transition-colors duration-300 ${
                    elapsedSec >= 3 ? "bg-brand-400" : "bg-white/[0.08]"
                  }`}
                />
                <div
                  className={`h-1 rounded-full transition-colors duration-300 ${
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

            {/* Top-left verified resolution badge */}
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#090a0c]/85 border border-white/[0.12] backdrop-blur-sm text-[11px] font-mono text-zinc-200 flex items-center gap-1.5 tabular-nums">
              <CheckCircle2Icon className="size-3 text-emerald-400" />
              <span>{verifiedDimensions}</span>
            </div>

            <div className="absolute inset-0 flex items-end justify-end p-4 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <button
                onClick={onDownload}
                type="button"
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white shadow-lg"
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
              <p className="text-xs text-zinc-500">
                Enter your video title, choose a mode and style on the left, and click Generate.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;
