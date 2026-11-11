import { useEffect, useRef, useState } from "react";
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
  LayoutGridIcon,
  ListVideoIcon,
  SunIcon,
  MoonIcon,
  MoveIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ArrowDownIcon,
} from "lucide-react";
import type { AspectRatio, IThumbnail } from "../assets/assets";

export type PreviewInspectMode =
  | "canvas"
  | "safezone"
  | "mobile_feed"
  | "desktop_home"
  | "suggested_sidebar";

export type OverlayPositionPreset = "top" | "bottom" | "left" | "right";
export type OverlayArrowDirection = "none" | "right" | "left" | "down";

interface PreviewPanelProps {
  thumbnail: IThumbnail | null;
  isLoading: boolean;
  aspectRatio: AspectRatio;
  overlayTitle?: string;
  overlayPosition?: OverlayPositionPreset;
  overlayAccent?: string;
  overlayArrow?: OverlayArrowDirection;
  overlayXPercent?: number | null;
  overlayYPercent?: number | null;
  onOverlayDragChange?: (xPercent: number, yPercent: number) => void;
  videoTitle?: string;
  competitorYoutubeUrl?: string;
}

const extractYoutubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.trim().match(p);
    if (m) return m[1];
  }
  return null;
};

const PreviewPanel = ({
  thumbnail,
  isLoading,
  aspectRatio,
  overlayTitle = "",
  overlayPosition = "bottom",
  overlayAccent = "#FFFFFF",
  overlayArrow = "none",
  overlayXPercent = null,
  overlayYPercent = null,
  onOverlayDragChange,
  videoTitle = "",
  competitorYoutubeUrl = "",
}: PreviewPanelProps) => {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [inspectMode, setInspectMode] = useState<PreviewInspectMode>("canvas");
  const [ytTheme, setYtTheme] = useState<"dark" | "light">("dark");
  const [customCompetitorUrl, setCustomCompetitorUrl] = useState("");
  const [competitorTitle, setCompetitorTitle] = useState(
    "We Tested Every Cloud Architecture Under 10M Requests"
  );
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

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

  const getExportUrl = (
    variant:
      | "master"
      | "yt_jpg_2mb"
      | "shorts_9_16"
      | "square_1_1"
      | "portrait_4_5"
  ) => {
    const apiBase =
      import.meta.env.VITE_BASE_URL ||
      (typeof window !== "undefined" &&
      window.location.origin.includes("localhost")
        ? "http://localhost:3000"
        : "");
    if (!thumbnail?._id) return thumbnail?.image_url || "";

    const params = new URLSearchParams({ variant });
    if (overlayTitle.trim()) {
      params.set("overlay_title", overlayTitle.trim());
      params.set("overlay_position", overlayPosition);
      params.set("overlay_accent", overlayAccent);
      params.set("overlay_arrow", overlayArrow);
      if (overlayXPercent !== null && overlayYPercent !== null) {
        params.set("overlay_x", String(Math.round(overlayXPercent)));
        params.set("overlay_y", String(Math.round(overlayYPercent)));
      }
    }
    return `${apiBase}/api/thumbnail/export/${thumbnail._id}?${params.toString()}`;
  };

  const handleExportDownload = (
    variant:
      | "master"
      | "yt_jpg_2mb"
      | "shorts_9_16"
      | "square_1_1"
      | "portrait_4_5"
  ) => {
    if (!thumbnail?._id && !thumbnail?.image_url) return;
    const url = getExportUrl(variant);
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const verifiedDimensions =
    thumbnail?.generation_meta?.resolution_actual?.dimensions ||
    (thumbnail?.resolution === "4k" ? "3840×2160 (4K)" : "2K Verified");

  const cleanOverlayTitle = overlayTitle.trim();
  const displayVideoTitle =
    videoTitle.trim() ||
    thumbnail?.title ||
    "Why Most Architecture Fails Under Real Load";

  // Resolve coordinates for interactive overlay
  const resolvedCoords = (() => {
    if (overlayXPercent !== null && overlayYPercent !== null) {
      return { x: overlayXPercent, y: overlayYPercent };
    }
    switch (overlayPosition) {
      case "top":
        return { x: 50, y: 15 };
      case "left":
        return { x: 32, y: 50 };
      case "right":
        return { x: 68, y: 50 };
      case "bottom":
      default:
        return { x: 50, y: 85 };
    }
  })();

  const handlePointerDownOverlay = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onOverlayDragChange || inspectMode !== "canvas") return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingOverlay(true);
  };

  const handlePointerMoveOverlay = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      !isDraggingOverlay ||
      !onOverlayDragChange ||
      !canvasContainerRef.current
    )
      return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.max(15, Math.min(85, Math.round(rawX)));
    const clampedY = Math.max(12, Math.min(88, Math.round(rawY)));
    onOverlayDragChange(clampedX, clampedY);
  };

  const handlePointerUpOverlay = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingOverlay) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDraggingOverlay(false);
  };

  const renderArrowIcon = (isCompact: boolean) => {
    if (overlayArrow === "none") return null;
    const sizeClass = isCompact ? "size-3.5" : "size-5 sm:size-6";
    if (overlayArrow === "right")
      return (
        <ArrowRightIcon
          className={`${sizeClass} shrink-0`}
          style={{ color: overlayAccent }}
        />
      );
    if (overlayArrow === "left")
      return (
        <ArrowLeftIcon
          className={`${sizeClass} shrink-0`}
          style={{ color: overlayAccent }}
        />
      );
    return (
      <ArrowDownIcon
        className={`${sizeClass} shrink-0`}
        style={{ color: overlayAccent }}
      />
    );
  };

  const renderOverlayTextElement = (isCompact = false, interactive = false) => {
    if (!cleanOverlayTitle) return null;
    return (
      <div
        onPointerDown={interactive ? handlePointerDownOverlay : undefined}
        onPointerMove={interactive ? handlePointerMoveOverlay : undefined}
        onPointerUp={interactive ? handlePointerUpOverlay : undefined}
        style={{
          left: `${resolvedCoords.x}%`,
          top: `${resolvedCoords.y}%`,
          transform: "translate(-50%, -50%)",
        }}
        className={`absolute z-20 select-none ${
          interactive
            ? "cursor-grab active:cursor-grabbing"
            : "pointer-events-none"
        }`}
      >
        <div
          className={`rounded-lg bg-[#090a0c]/88 border px-3 py-1.5 shadow-xl flex items-center gap-2 ${
            isDraggingOverlay
              ? "border-brand-400 ring-2 ring-brand-400/30"
              : "border-white/[0.16]"
          }`}
        >
          {overlayArrow === "left" && renderArrowIcon(isCompact)}
          <span
            style={{ color: overlayAccent }}
            className={`block font-black uppercase tracking-tight text-center leading-tight whitespace-nowrap ${
              isCompact ? "text-[10px]" : "text-sm sm:text-xl"
            }`}
          >
            {cleanOverlayTitle}
          </span>
          {(overlayArrow === "right" || overlayArrow === "down") &&
            renderArrowIcon(isCompact)}
          {interactive && (
            <MoveIcon className="size-3 text-zinc-400 ml-0.5 shrink-0 opacity-75" />
          )}
        </div>
      </div>
    );
  };

  const activeCompetitorUrl =
    customCompetitorUrl.trim() || competitorYoutubeUrl.trim();
  const competitorVideoId = extractYoutubeId(activeCompetitorUrl);
  const competitorThumbSrc = competitorVideoId
    ? `https://img.youtube.com/vi/${competitorVideoId}/hqdefault.jpg`
    : null;

  const isFeedSimulator =
    inspectMode === "mobile_feed" ||
    inspectMode === "desktop_home" ||
    inspectMode === "suggested_sidebar";

  const ytBg =
    ytTheme === "dark"
      ? "bg-[#0f0f0f] text-[#f1f1f1]"
      : "bg-[#ffffff] text-[#0f0f0f]";
  const ytCardBorder =
    ytTheme === "dark" ? "border-white/[0.08]" : "border-black/[0.08]";
  const ytSubtext = ytTheme === "dark" ? "text-[#aaaaaa]" : "text-[#606060]";

  return (
    <div className="relative mx-auto w-full">
      {/* Studio Inspect & YouTube Context Simulator Toolbar (Feature 1 & Section 10A.3) */}
      <div className="px-3.5 py-2 border-b border-white/[0.08] bg-[#111317] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#090a0c] p-0.5 border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setInspectMode("canvas")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${
              inspectMode === "canvas"
                ? "bg-[#171a20] text-zinc-100 border border-white/[0.1]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <MonitorIcon className="size-3" />
            <span>Canvas</span>
          </button>

          <button
            type="button"
            onClick={() => setInspectMode("safezone")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${
              inspectMode === "safezone"
                ? "bg-[#171a20] text-zinc-100 border border-white/[0.1]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ScanIcon className="size-3" />
            <span>Safe Zone</span>
          </button>

          <button
            type="button"
            onClick={() => setInspectMode("mobile_feed")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${
              inspectMode === "mobile_feed"
                ? "bg-[#171a20] text-zinc-100 border border-white/[0.1]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <SmartphoneIcon className="size-3" />
            <span>Mobile (320×180)</span>
          </button>

          <button
            type="button"
            onClick={() => setInspectMode("desktop_home")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${
              inspectMode === "desktop_home"
                ? "bg-[#171a20] text-zinc-100 border border-white/[0.1]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <LayoutGridIcon className="size-3" />
            <span>YT Home Grid</span>
          </button>

          <button
            type="button"
            onClick={() => setInspectMode("suggested_sidebar")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${
              inspectMode === "suggested_sidebar"
                ? "bg-[#171a20] text-zinc-100 border border-white/[0.1]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ListVideoIcon className="size-3" />
            <span>Sidebar (168×94)</span>
          </button>
        </div>

        {/* YouTube Dark / Light Theme Toggle when in any Feed Simulator mode */}
        {isFeedSimulator ? (
          <button
            type="button"
            onClick={() => setYtTheme(ytTheme === "dark" ? "light" : "dark")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#090a0c] border border-white/[0.1] text-[11px] font-mono text-zinc-200"
          >
            {ytTheme === "dark" ? (
              <>
                <MoonIcon className="size-3 text-brand-400" />
                <span>YT Dark (#0f0f0f)</span>
              </>
            ) : (
              <>
                <SunIcon className="size-3 text-amber-400" />
                <span>YT Light (#ffffff)</span>
              </>
            )}
          </button>
        ) : (
          <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
            {inspectMode === "safezone"
              ? "Center 80% + YT Badge"
              : cleanOverlayTitle
              ? `Drag Headline (${resolvedCoords.x}%, ${resolvedCoords.y}%)`
              : `sRGB · ${aspectRatio}`}
          </span>
        )}
      </div>

      {/* FEATURE 1: YOUTUBE FEED CONTEXT SIMULATORS (Mobile 320x180, Desktop Home Grid, Suggested Sidebar 168x94) */}
      {isFeedSimulator && !isLoading ? (
        <div
          className={`p-5 transition-colors duration-150 ${ytBg} min-h-[340px] flex flex-col justify-between gap-4`}
        >
          {/* Competitor Benchmark Bar */}
          {(inspectMode === "desktop_home" ||
            inspectMode === "suggested_sidebar") && (
            <div
              className={`p-2.5 rounded-lg border ${ytCardBorder} flex flex-col sm:flex-row gap-2 items-center justify-between text-xs`}
            >
              <input
                type="text"
                value={customCompetitorUrl}
                onChange={(e) => setCustomCompetitorUrl(e.target.value)}
                placeholder="Paste Competitor YouTube URL (e.g. https://youtu.be/dQw4w9WgXcQ) to compare side-by-side…"
                className={`w-full sm:flex-1 px-2.5 py-1.5 rounded border ${ytCardBorder} bg-transparent text-xs focus:outline-none`}
              />
              <input
                type="text"
                value={competitorTitle}
                onChange={(e) => setCompetitorTitle(e.target.value)}
                placeholder="Competitor title…"
                className={`w-full sm:w-56 px-2.5 py-1.5 rounded border ${ytCardBorder} bg-transparent text-xs focus:outline-none`}
              />
            </div>
          )}

          {/* Simulator 1: Mobile Feed (320x180) */}
          {inspectMode === "mobile_feed" && (
            <div className="my-auto flex flex-col items-center">
              <div
                className={`w-[320px] max-w-full rounded-xl border ${ytCardBorder} p-3 space-y-2.5`}
              >
                <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
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
                  {renderOverlayTextElement(true, false)}
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 text-[10px] font-mono font-semibold text-white tabular-nums">
                    14:28
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-0.5">
                  <div className="size-7 rounded-full bg-brand-600 text-white shrink-0 flex items-center justify-center text-[10px] font-mono font-semibold">
                    YOU
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold line-clamp-2 leading-snug">
                      {displayVideoTitle}
                    </p>
                    <p className={`text-[11px] ${ytSubtext} mt-0.5 tabular-nums`}>
                      Your Channel · 142K views · 2 hours ago
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Simulator 2: Desktop Home 2-Up Comparison Grid */}
          {inspectMode === "desktop_home" && (
            <div className="my-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* User Card */}
              <div className="space-y-2.5">
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black ring-2 ring-brand-500/60">
                  {thumbnail?.image_url ? (
                    <img
                      src={thumbnail.image_url}
                      alt={displayVideoTitle}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs font-mono text-zinc-500">
                      Your Thumbnail (16:9)
                    </div>
                  )}
                  {renderOverlayTextElement(true, false)}
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-brand-600 text-[10px] font-mono font-semibold text-white">
                    YOUR THUMBNAIL
                  </div>
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 text-[10px] font-mono font-semibold text-white tabular-nums">
                    14:28
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="size-8 rounded-full bg-brand-600 text-white shrink-0 flex items-center justify-center text-[10px] font-mono font-semibold">
                    YOU
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold line-clamp-2 leading-snug">
                      {displayVideoTitle}
                    </p>
                    <p className={`text-[11px] ${ytSubtext} mt-0.5 tabular-nums`}>
                      Your Channel · 184K views · 3 hours ago
                    </p>
                  </div>
                </div>
              </div>

              {/* Competitor Card */}
              <div className="space-y-2.5">
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-900">
                  {competitorThumbSrc ? (
                    <img
                      src={competitorThumbSrc}
                      alt={competitorTitle}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-zinc-900 to-zinc-800">
                      <span className="text-sm font-black uppercase tracking-tight text-amber-400">
                        10M REQ/SEC BENCHMARK
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400 mt-1">
                        Paste a YouTube URL above to load real competitor frame
                      </span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-zinc-300">
                    COMPETITOR
                  </div>
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 text-[10px] font-mono font-semibold text-white tabular-nums">
                    19:04
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="size-8 rounded-full bg-zinc-700 text-zinc-200 shrink-0 flex items-center justify-center text-[10px] font-mono font-semibold">
                    CMP
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold line-clamp-2 leading-snug">
                      {competitorTitle}
                    </p>
                    <p className={`text-[11px] ${ytSubtext} mt-0.5 tabular-nums`}>
                      Competitor Channel · 410K views · 1 day ago
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Simulator 3: Suggested Video Sidebar (168x94) */}
          {inspectMode === "suggested_sidebar" && (
            <div className="my-auto max-w-md mx-auto w-full space-y-3">
              {/* User Suggested Row */}
              <div
                className={`p-2 rounded-xl border ${ytCardBorder} flex items-start gap-2.5`}
              >
                <div className="relative w-[168px] h-[94px] rounded-lg overflow-hidden bg-black shrink-0 ring-2 ring-brand-500/60">
                  {thumbnail?.image_url ? (
                    <img
                      src={thumbnail.image_url}
                      alt={displayVideoTitle}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] font-mono text-zinc-500">
                      168 × 94 px
                    </div>
                  )}
                  {renderOverlayTextElement(true, false)}
                  <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/85 text-[9px] font-mono font-semibold text-white tabular-nums">
                    14:28
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold line-clamp-2 leading-snug">
                    {displayVideoTitle}
                  </p>
                  <p className={`text-[11px] ${ytSubtext} mt-1`}>Your Channel</p>
                  <p className={`text-[11px] ${ytSubtext} tabular-nums`}>
                    142K views · New
                  </p>
                </div>
              </div>

              {/* Competitor Suggested Row */}
              <div
                className={`p-2 rounded-xl border ${ytCardBorder} flex items-start gap-2.5 opacity-90`}
              >
                <div className="relative w-[168px] h-[94px] rounded-lg overflow-hidden bg-zinc-900 shrink-0">
                  {competitorThumbSrc ? (
                    <img
                      src={competitorThumbSrc}
                      alt={competitorTitle}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] font-mono text-amber-400 font-bold text-center px-2">
                      COMPETITOR 168×94
                    </div>
                  )}
                  <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/85 text-[9px] font-mono font-semibold text-white tabular-nums">
                    19:04
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold line-clamp-2 leading-snug">
                    {competitorTitle}
                  </p>
                  <p className={`text-[11px] ${ytSubtext} mt-1`}>
                    Competitor Channel
                  </p>
                  <p className={`text-[11px] ${ytSubtext} tabular-nums`}>
                    410K views · 1 day ago
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className={`text-[11px] ${ytSubtext} text-center`}>
            YouTube Context Simulator ({ytTheme.toUpperCase()} theme): Check silhouette contrast, 5-word headline legibility, and bottom-right timestamp clearance.
          </p>
        </div>
      ) : (
        <div
          ref={canvasContainerRef}
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

              {renderOverlayTextElement(false, inspectMode === "canvas")}

              {/* Top-left verified resolution badge */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#090a0c]/85 border border-white/[0.12] text-[11px] font-mono text-zinc-200 flex items-center gap-1.5 tabular-nums">
                <CheckCircle2Icon className="size-3 text-emerald-400" />
                <span>{verifiedDimensions}</span>
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-4 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <button
                  onClick={() => handleExportDownload("master")}
                  type="button"
                  className="pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white"
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
                  Enter your video title, drag your headline overlay anywhere on this stage, and click Generate.
                </p>
              </div>

              {renderOverlayTextElement(false, inspectMode === "canvas")}
            </div>
          )}

          {/* Safe-Zone & YouTube Duration Badge Overlay (Section 10A.3 & 10A.11) */}
          {inspectMode === "safezone" && !isLoading && (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-[10%] border border-dashed border-emerald-400/70 rounded-lg flex items-start justify-between p-2">
                <span className="px-2 py-0.5 rounded bg-[#090a0c]/90 border border-emerald-400/40 text-[10px] font-mono text-emerald-300 tabular-nums">
                  Center 80% Focal &amp; Face Safe Zone
                </span>
              </div>

              <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded bg-black/90 border border-amber-400/60 text-xs font-mono font-semibold text-amber-300 tabular-nums">
                14:28 · YT Badge
              </div>
            </div>
          )}
        </div>
      )}

      {/* FEATURE 4: ONE-CLICK MULTI-PLATFORM SMART-CROP & <=2MB STUDIO EXPORT PACK */}
      {!isLoading && thumbnail?.image_url && (
        <div className="px-4 py-3 border-t border-white/[0.08] bg-[#0d0f13] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
            <DownloadIcon className="size-3.5 text-brand-400 shrink-0" />
            <span>One-Click Export Pack (0 cr):</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleExportDownload("master")}
              className="px-2.5 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-[11px] font-semibold tabular-nums"
            >
              Master WebP
            </button>
            <button
              type="button"
              onClick={() => handleExportDownload("yt_jpg_2mb")}
              className="px-2.5 py-1.5 rounded-md bg-[#171a20] hover:bg-white/[0.1] border border-white/[0.1] text-zinc-200 text-[11px] font-medium tabular-nums"
              title="1280×720 JPEG guaranteed <= 2.0 MB for YouTube Studio upload"
            >
              YT Studio ≤2MB JPG
            </button>
            <button
              type="button"
              onClick={() => handleExportDownload("shorts_9_16")}
              className="px-2.5 py-1.5 rounded-md bg-[#171a20] hover:bg-white/[0.1] border border-white/[0.1] text-zinc-200 text-[11px] font-medium tabular-nums"
              title="Attention-centered 1080×1920 vertical Shorts/Reels crop"
            >
              Shorts 9:16 Crop
            </button>
            <button
              type="button"
              onClick={() => handleExportDownload("square_1_1")}
              className="px-2.5 py-1.5 rounded-md bg-[#171a20] hover:bg-white/[0.1] border border-white/[0.1] text-zinc-200 text-[11px] font-medium tabular-nums"
              title="Attention-centered 1080×1080 Community & Instagram crop"
            >
              Square 1:1 Crop
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewPanel;
