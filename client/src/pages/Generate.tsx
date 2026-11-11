import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import {
  colorSchemes,
  platforms,
  GENERATION_MODES,
  type AspectRatio,
  type Resolution,
  type GenerationModeId,
  type IThumbnail,
  type ThumbnailStyle,
} from "../assets/assets";
import AspectRatioSelector from "../components/AspectRatioSelector";
import StyleSelector from "../components/StyleSelector";
import ColorSchemeSelector from "../components/ColorSchemeSelector";
import PlatformSelector from "../components/PlatformSelector";
import ResolutionSelector from "../components/ResolutionSelector";
import PreviewPanel from "../components/PreviewPanel";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import api from "../configs/api";
import SEO from "../components/SEO";
import {
  SparklesIcon,
  AlertCircleIcon,
  UploadIcon,
  XIcon,
  ImageIcon,
  LinkIcon,
  PencilLineIcon,
  LockIcon,
  RefreshCwIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "lucide-react";

const createIdempotencyKey = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
};

const formatApiErrorMessage = (error: any): string => {
  const code = error?.response?.data?.error_code;
  const serverMessage = error?.response?.data?.message;
  const retryAfter = error?.response?.headers?.["retry-after"];

  switch (code) {
    case "INSUFFICIENT_CREDITS":
      return "Insufficient credits for the selected mode. Choose a lower-credit mode or top up your account.";
    case "CONTENT_POLICY_REJECTED":
      return "Prompt or reference image was rejected by safety filters. Your reserved credits were refunded — please revise your prompt.";
    case "TOO_MANY_CONCURRENT_JOBS":
      return serverMessage || "You have reached your plan's concurrent active job limit. Wait a few seconds for an active job to finish.";
    case "QUEUE_BUSY":
      return `The generation queue is currently under heavy load.${
        retryAfter ? ` Please retry in ~${retryAfter}s.` : " Please retry shortly."
      }`;
    case "MODE_NOT_ALLOWED_FOR_PLAN":
      return "This generation mode requires the Creator or Pro plan.";
    case "RESOLUTION_NOT_ALLOWED_FOR_PLAN":
      return "4K resolution requires the Creator or Pro plan.";
    case "REFERENCE_IMAGES_NOT_ALLOWED":
      return "Reference image conditioning requires the Creator or Pro plan.";
    default:
      return serverMessage || error?.message || "Something went wrong. Please try again.";
  }
};

const Generate = () => {
  const { id } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, setUser } = useAuth();

  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [thumbnail, setThumbnail] = useState<IThumbnail | null>(null);
  const [loading, setLoading] = useState(false);

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [colorSchemeId, setColorSchemeId] = useState<string>(colorSchemes[0].id);
  const [style, setStyle] = useState<ThumbnailStyle>("Bold & Graphic");

  const [platform, setPlatform] = useState<string>("youtube");
  const [mode, setMode] = useState<GenerationModeId>("standard");
  const [resolution, setResolution] = useState<Resolution>("2k");

  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);

  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [ytThumbnailPreview, setYtThumbnailPreview] = useState<string | null>(null);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [sseReconnectKey, setSseReconnectKey] = useState(0);

  const hasNoPlan = !user || user.plan === "none";
  const hasNoCredits = Boolean(user && user.credits <= 0);
  const isCreatorOrPro = user?.plan === "creator" || user?.plan === "pro";
  const canUploadImage = isCreatorOrPro;
  const canUse4K = isCreatorOrPro;

  // Keep mode and resolution synchronized
  const handleModeChange = (nextMode: GenerationModeId) => {
    setMode(nextMode);
    if (nextMode === "ultra") {
      setResolution("4k");
    } else if (resolution === "4k") {
      setResolution("2k");
    }
  };

  const handleResolutionChange = (nextRes: Resolution) => {
    setResolution(nextRes);
    if (nextRes === "4k") {
      setMode("ultra");
    } else if (mode === "ultra") {
      setMode(referenceImage && canUploadImage ? "premium" : "standard");
    }
  };

  const selectedModeMeta =
    GENERATION_MODES.find((m) => m.id === mode) || GENERATION_MODES[1];
  const creditsCost = selectedModeMeta.credits;

  // Edit uses the thumbnail's existing mode or falls back to standard (2 cr) / premium (3 cr) / ultra (5 cr)
  const editModeId: GenerationModeId =
    thumbnail?.mode || (thumbnail?.resolution === "4k" ? "ultra" : "standard");
  const editCreditsCost =
    GENERATION_MODES.find((m) => m.id === editModeId)?.credits ?? 2;

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  };

  const handleYoutubeUrlChange = (url: string) => {
    setYoutubeUrl(url);
    const videoId = extractVideoId(url.trim());
    if (videoId) {
      setYtThumbnailPreview(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`);
    } else {
      setYtThumbnailPreview(null);
    }
  };

  const clearYoutubeUrl = () => {
    setYoutubeUrl("");
    setYtThumbnailPreview(null);
  };

  const handlePlatformChange = (newPlatform: string) => {
    setPlatform(newPlatform);
    const platformData = platforms.find((p) => p.id === newPlatform);
    if (platformData) {
      setAspectRatio(platformData.aspectRatio);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be under 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setReferenceImage(event.target?.result as string);
      // Automatically switch to a reference-capable mode if currently on fast/standard
      if (isCreatorOrPro && (mode === "fast" || mode === "standard")) {
        setMode("premium");
      }
    };
    reader.readAsDataURL(file);
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async () => {
    if (!isLoggedIn) return toast.error("Please sign in to generate thumbnails");
    if (hasNoPlan) return toast.error("Please select a credit pack first");
    if (hasNoCredits || (user && user.credits < creditsCost)) {
      return toast.error(
        `This mode requires ${creditsCost} credit(s), but you have ${user?.credits ?? 0}.`
      );
    }

    if (!title.trim()) {
      setTitleError("Enter a title or topic for your thumbnail");
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.error("Title is required to generate a thumbnail");
      return;
    }

    setTitleError("");
    setErrorBanner(null);
    setLoading(true);

    try {
      const api_payload: Record<string, unknown> = {
        title: title.trim(),
        prompt: additionalDetails.trim(),
        style,
        aspect_ratio: aspectRatio,
        color_scheme: colorSchemeId,
        text_overlay: true,
        mode,
        resolution,
        platform,
        youtube_reference_url: youtubeUrl.trim() || undefined,
      };

      if (referenceImage && canUploadImage) {
        api_payload.reference_image = referenceImage;
      }

      const { data } = await api.post("/api/thumbnail/generate", api_payload, {
        headers: {
          "Idempotency-Key": createIdempotencyKey(),
        },
      });

      if (data.thumbnail) {
        if (user && data.credits !== undefined) {
          setUser({ ...user, credits: data.credits });
        }
        navigate("/generate/" + data.thumbnail._id);
        toast.success(data.message || "Generation started");
      }
    } catch (error: any) {
      const friendly = formatApiErrorMessage(error);
      setErrorBanner(friendly);
      toast.error(friendly);
      setLoading(false);
    }
  };

  const handleNewGenerate = () => {
    setTitle("");
    setTitleError("");
    setErrorBanner(null);
    setAdditionalDetails("");
    setStyle("Bold & Graphic");
    setAspectRatio("16:9");
    setColorSchemeId(colorSchemes[0].id);
    setPlatform("youtube");
    setMode("standard");
    setResolution("2k");
    setReferenceImage(null);
    setYoutubeUrl("");
    setYtThumbnailPreview(null);
    setThumbnail(null);
    setLoading(false);
    setEditMode(false);
    setEditInstructions("");
    setEditLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    navigate("/generate");
  };

  const handleEdit = async () => {
    if (!isLoggedIn) return toast.error("Please sign in to edit thumbnails");
    if (!editInstructions.trim()) {
      toast.error("Describe what you want to change");
      return;
    }
    if (hasNoCredits || (user && user.credits < editCreditsCost)) {
      return toast.error(
        `Editing requires ${editCreditsCost} credit(s), but you have ${user?.credits ?? 0}.`
      );
    }

    setErrorBanner(null);
    setEditLoading(true);
    try {
      const { data } = await api.post(
        "/api/thumbnail/edit",
        {
          thumbnailId: id,
          edit_instructions: editInstructions.trim(),
          mode: editModeId,
        },
        {
          headers: {
            "Idempotency-Key": createIdempotencyKey(),
          },
        }
      );
      if (data.thumbnail) {
        if (user && data.credits !== undefined) {
          setUser({ ...user, credits: data.credits });
        }
        setThumbnail(data.thumbnail);
        setLoading(true);
        setEditMode(false);
        setEditInstructions("");
        setSseReconnectKey((k) => k + 1);
        toast.success(data.message || "Applying edit…");
      }
    } catch (error: any) {
      const friendly = formatApiErrorMessage(error);
      setErrorBanner(friendly);
      toast.error(friendly);
    } finally {
      setEditLoading(false);
    }
  };

  const fetchThumbnail = async () => {
    try {
      const { data } = await api.get(`/api/user/thumbnail/${id}`);
      const thumb = data?.thumbnail as IThumbnail | undefined;
      if (thumb) {
        setThumbnail(thumb);
        const isDoneOrFailed =
          !thumb.isGenerating && Boolean(thumb.image_url || thumb.error);
        setLoading(!isDoneOrFailed);

        if (user && data.credits !== undefined) {
          setUser({
            ...user,
            credits: data.credits,
            totalCredits: data.totalCredits ?? user.totalCredits,
          });
        }

        setAdditionalDetails(thumb.user_prompt || "");
        setTitle(thumb.title || "");
        if (thumb.color_scheme) setColorSchemeId(thumb.color_scheme);
        if (thumb.aspect_ratio) setAspectRatio(thumb.aspect_ratio as AspectRatio);
        if (thumb.style) setStyle(thumb.style);
        if (thumb.platform) setPlatform(thumb.platform);
        if (thumb.resolution) setResolution(thumb.resolution);
        if (thumb.mode) {
          setMode(thumb.mode);
        } else if (thumb.resolution === "4k") {
          setMode("ultra");
        }
        if (thumb.youtube_reference_url) {
          handleYoutubeUrlChange(thumb.youtube_reference_url);
        }
      }
    } catch (error: any) {
      toast.error(formatApiErrorMessage(error));
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !id) return;

    fetchThumbnail();

    const apiBase =
      import.meta.env.VITE_BASE_URL ||
      (typeof window !== "undefined" && window.location.origin.includes("localhost")
        ? "http://localhost:3000"
        : "");

    const evtSource = new EventSource(`${apiBase}/api/sse/thumbnail/${id}`, {
      withCredentials: true,
    });

    let completed = false;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    const stopFallback = () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

    const startFallback = () => {
      if (fallbackInterval || completed) return;
      fallbackInterval = setInterval(async () => {
        try {
          const { data } = await api.get(`/api/user/thumbnail/${id}`);
          const thumb = data?.thumbnail as IThumbnail | undefined;
          if (thumb && !thumb.isGenerating && (thumb.image_url || thumb.error)) {
            setThumbnail(thumb);
            setLoading(false);
            completed = true;
            stopFallback();
            api
              .get("/api/auth/verify")
              .then(({ data: d }) => {
                if (d?.user) setUser(d.user);
              })
              .catch(() => {});
          }
        } catch {
          // transient network error during poll
        }
      }, 4000);
    };

    evtSource.addEventListener("complete", (e) => {
      completed = true;
      stopFallback();
      try {
        const payload = JSON.parse(e.data);
        if (payload.thumbnail) {
          setThumbnail(payload.thumbnail as IThumbnail);
          setLoading(false);
          api
            .get("/api/auth/verify")
            .then(({ data }) => {
              if (data?.user) setUser(data.user);
            })
            .catch(() => {});
        }
      } catch {}
      evtSource.close();
    });

    evtSource.addEventListener("failed", (e) => {
      completed = true;
      stopFallback();
      try {
        const payload = JSON.parse(e.data);
        setLoading(false);
        setThumbnail((prev) =>
          prev
            ? {
                ...prev,
                isGenerating: false,
                error: payload?.message || "Generation failed — credits refunded.",
              }
            : null
        );
        if (payload?.message) {
          setErrorBanner(payload.message);
        }
        api
          .get("/api/auth/verify")
          .then(({ data }) => {
            if (data?.user) setUser(data.user);
          })
          .catch(() => {});
      } catch {}
      evtSource.close();
    });

    evtSource.addEventListener("timeout", () => {
      evtSource.close();
      startFallback();
    });

    evtSource.addEventListener("error_event", () => {
      evtSource.close();
      startFallback();
    });

    evtSource.onerror = () => {
      if (!completed) {
        evtSource.close();
        startFallback();
      }
    };

    return () => {
      completed = true;
      evtSource.close();
      stopFallback();
    };
  }, [id, isLoggedIn, sseReconnectKey]);

  useEffect(() => {
    if (!id && thumbnail) {
      setThumbnail(null);
    }
  }, [pathname]);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/");
    }
  }, [isLoggedIn]);

  if (isLoggedIn && hasNoPlan) {
    return (
      <div className="pt-24 min-h-screen flex items-center justify-center px-6 bg-[#090a0c]">
        <div className="max-w-md w-full text-center bg-[#111317] border border-white/[0.08] rounded-xl p-8 space-y-4">
          <div className="size-12 bg-[#171a20] border border-white/[0.08] rounded-xl flex items-center justify-center mx-auto text-brand-400">
            <SparklesIcon className="size-5" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-100">Select a Credit Pack</h1>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Choose a one-time credit pack (starting at $6 for 25 credits) to unlock the AI Thumbnail Studio.
          </p>
          <Link
            to="/profile"
            className="block w-full py-3 bg-zinc-100 text-zinc-950 hover:bg-white rounded-lg text-sm font-semibold"
          >
            View Plans &amp; Credits
          </Link>
        </div>
      </div>
    );
  }

  if (isLoggedIn && hasNoCredits && !id) {
    return (
      <div className="pt-24 min-h-screen flex items-center justify-center px-6 bg-[#090a0c]">
        <div className="max-w-md w-full text-center bg-[#111317] border border-amber-500/30 rounded-xl p-8 space-y-4">
          <div className="size-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mx-auto text-amber-400">
            <AlertCircleIcon className="size-5" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-100">0 Credits Remaining</h1>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            You have used all available credits on your account. Top up your balance to continue generating thumbnails.
          </p>
          <Link
            to="/profile"
            className="block w-full py-3 bg-zinc-100 text-zinc-950 hover:bg-white rounded-lg text-sm font-semibold"
          >
            Top Up Credits
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Studio — ThumbGen"
        description="Configure generation mode, aspect ratio, resolution, and art direction for your thumbnail."
        url="https://thumbgen.online/generate"
      />

      <div className="min-h-screen bg-[#090a0c] pt-20 pb-16">
        <main className="max-w-7xl mx-auto px-6 py-6">
          {/* Top Studio Bar */}
          <div className="pb-6 mb-6 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.02em] text-zinc-100">
                Thumbnail Studio
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                Configure mode, aspect ratio, and visual direction. Credits are committed only when your image succeeds.
              </p>
            </div>

            {user && (
              <div className="flex items-center gap-3 self-start sm:self-auto">
                <div className="px-3.5 py-2 rounded-lg bg-[#111317] border border-white/[0.08] flex items-center gap-3 text-xs tabular-nums">
                  <span className="text-zinc-400">Plan:</span>
                  <span className="font-semibold text-zinc-100 uppercase">
                    {user.plan}
                  </span>
                  <span className="text-white/15">|</span>
                  <span className="text-zinc-400">Balance:</span>
                  <span className="font-mono font-semibold text-brand-400">
                    {user.credits} / {user.totalCredits} cr
                  </span>
                </div>
                {id && (
                  <button
                    type="button"
                    onClick={handleNewGenerate}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#171a20] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-medium text-zinc-200"
                  >
                    <PlusIcon className="size-3.5" />
                    <span>New</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {errorBanner && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 flex items-start justify-between gap-3 text-xs text-red-200">
              <div className="flex items-start gap-2.5">
                <AlertCircleIcon className="size-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="text-zinc-400 hover:text-white"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          )}

          <div className="grid lg:grid-cols-[440px_1fr] xl:grid-cols-[480px_1fr] gap-8 items-start">
            {/* LEFT INSPECTOR COLUMN */}
            <div className={`space-y-5 ${id ? "pointer-events-none opacity-75" : ""}`}>
              {/* SECTION 1: CONCEPT & PROMPT */}
              <section className="p-5 rounded-xl bg-[#111317] border border-white/[0.08] space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                    1. Concept &amp; Copy
                  </h2>
                  <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                    {title.length}/100
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Video Title or Hook <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (e.target.value.trim()) setTitleError("");
                    }}
                    maxLength={100}
                    placeholder="e.g., 10 Tips for Better Sleep"
                    className={`w-full px-3.5 py-2.5 rounded-lg border bg-[#090a0c] text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none ${
                      titleError
                        ? "border-red-500"
                        : "border-white/[0.08] focus:border-brand-400"
                    }`}
                  />
                  {titleError && (
                    <p className="text-xs text-red-400">{titleError}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Scene &amp; Subject Direction{" "}
                    <span className="text-zinc-500 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={additionalDetails}
                    onChange={(e) => setAdditionalDetails(e.target.value)}
                    rows={3}
                    placeholder="Describe facial expression, foreground objects, lighting contrast, or background setting…"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] bg-[#090a0c] text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-brand-400 resize-none"
                  />
                </div>
              </section>

              {/* SECTION 2: GENERATION MODE & RESOLUTION */}
              <section className="p-5 rounded-xl bg-[#111317] border border-white/[0.08] space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                    2. Mode &amp; Resolution
                  </h2>
                  <span className="text-xs font-mono font-semibold text-brand-400 tabular-nums">
                    {creditsCost} {creditsCost === 1 ? "credit" : "credits"}
                  </span>
                </div>

                {/* Mode Selector Grid */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-zinc-300">
                    Generation Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {GENERATION_MODES.map((m) => {
                      const isLocked =
                        !isCreatorOrPro && !m.allowedPlans.includes("starter");
                      const isSelected = mode === m.id;

                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={isLocked}
                          onClick={() => !isLocked && handleModeChange(m.id)}
                          className={`p-3 rounded-lg border text-left transition-colors flex flex-col justify-between gap-1.5 ${
                            isLocked
                              ? "border-white/[0.06] bg-[#090a0c]/50 opacity-55 cursor-not-allowed"
                              : isSelected
                              ? "bg-brand-500/[0.12] border-brand-500/50 text-zinc-100"
                              : "border-white/[0.08] bg-[#090a0c] hover:border-white/[0.16] text-zinc-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-semibold text-zinc-100 truncate">
                              {m.label}
                            </span>
                            {isLocked ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded shrink-0">
                                <LockIcon className="size-2.5" />
                                Creator+
                              </span>
                            ) : (
                              <span className="text-[11px] font-mono font-semibold text-brand-300 shrink-0 tabular-nums">
                                {m.credits} cr
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 line-clamp-2 leading-snug">
                            {m.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <ResolutionSelector
                  value={resolution}
                  onChange={handleResolutionChange}
                  canUse4K={canUse4K}
                />
              </section>

              {/* SECTION 3: PLATFORM & ASPECT RATIO */}
              <section className="p-5 rounded-xl bg-[#111317] border border-white/[0.08] space-y-5">
                <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                  3. Destination &amp; Ratio
                </h2>
                <PlatformSelector value={platform} onChange={handlePlatformChange} />
                <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />
              </section>

              {/* SECTION 4: ART DIRECTION */}
              <section className="p-5 rounded-xl bg-[#111317] border border-white/[0.08] space-y-5">
                <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                  4. Visual Direction
                </h2>
                <StyleSelector
                  value={style}
                  onChange={setStyle}
                  isOpen={styleDropdownOpen}
                  setIsOpen={setStyleDropdownOpen}
                />
                <ColorSchemeSelector
                  value={colorSchemeId}
                  onChange={setColorSchemeId}
                />
              </section>

              {/* SECTION 5: REFERENCE INPUTS */}
              <section className="p-5 rounded-xl bg-[#111317] border border-white/[0.08] space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                    5. Reference Conditioning
                  </h2>
                  {!canUploadImage && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                      <LockIcon className="size-2.5" />
                      Creator / Pro
                    </span>
                  )}
                </div>

                {/* Subject / Face Reference Photo */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-zinc-300">
                      Reference Photo{" "}
                      <span className="text-zinc-500 font-normal">(optional)</span>
                    </label>
                    {canUploadImage && (
                      <span className="text-[11px] font-mono text-zinc-400">
                        Included in 3 cr / 5 cr modes
                      </span>
                    )}
                  </div>

                  {canUploadImage ? (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      {referenceImage ? (
                        <div className="relative group rounded-lg overflow-hidden border border-white/[0.12] bg-[#090a0c]">
                          <img
                            src={referenceImage}
                            alt="Reference upload"
                            className="w-full h-36 object-cover"
                          />
                          <button
                            type="button"
                            onClick={removeReferenceImage}
                            className="absolute top-2 right-2 p-1.5 bg-[#090a0c]/85 hover:bg-red-600 text-zinc-200 hover:text-white rounded-md border border-white/[0.12]"
                            aria-label="Remove reference image"
                          >
                            <XIcon className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full py-6 rounded-lg border border-dashed border-white/[0.12] hover:border-brand-400/50 bg-[#090a0c] flex flex-col items-center gap-2 text-zinc-400 hover:text-zinc-200"
                        >
                          <UploadIcon className="size-5" />
                          <span className="text-xs font-medium">
                            Upload portrait or subject image (PNG/JPG up to 5MB)
                          </span>
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="w-full py-4 px-3 rounded-lg border border-white/[0.06] bg-[#090a0c]/50 flex items-center justify-center gap-2 text-xs text-zinc-500">
                      <ImageIcon className="size-4" />
                      <span>Upgrade to Creator or Pro to condition on reference photos</span>
                    </div>
                  )}
                </div>

                {/* YouTube Reference URL */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-zinc-300">
                    YouTube Style Reference URL{" "}
                    <span className="text-zinc-500 font-normal">(optional)</span>
                  </label>
                  {canUploadImage ? (
                    <div className="space-y-2.5">
                      <div className="relative">
                        <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                        <input
                          type="text"
                          value={youtubeUrl}
                          onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                          className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-white/[0.08] bg-[#090a0c] text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-brand-400"
                        />
                        {youtubeUrl && (
                          <button
                            type="button"
                            onClick={clearYoutubeUrl}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white"
                            aria-label="Clear YouTube URL"
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        )}
                      </div>
                      {ytThumbnailPreview && (
                        <div className="rounded-lg overflow-hidden border border-white/[0.08] bg-[#090a0c]">
                          <img
                            src={ytThumbnailPreview}
                            alt="YouTube reference thumbnail"
                            className="w-full h-24 object-cover"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full py-3.5 px-3 rounded-lg border border-white/[0.06] bg-[#090a0c]/50 flex items-center justify-center gap-2 text-xs text-zinc-500">
                      <LinkIcon className="size-4" />
                      <span>Upgrade to Creator or Pro for YouTube style referencing</span>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* RIGHT STICKY CANVAS & ACTIONS */}
            <div className=" lg:sticky lg:top-24 space-y-4">
              {/* Preview Frame */}
              <div className="rounded-xl border border-white/[0.08] bg-[#111317] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.08] bg-[#0d0f13] flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-300">
                    Stage Preview ({aspectRatio})
                  </span>
                  <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                    {selectedModeMeta.label} · {resolution.toUpperCase()}
                  </span>
                </div>

                <PreviewPanel
                  thumbnail={thumbnail}
                  isLoading={loading}
                  aspectRatio={aspectRatio}
                />
              </div>

              {/* State 1: Blank Form — Primary Generate Button & Exact Cost Breakdown */}
              {!id && (
                <div className="rounded-xl border border-white/[0.08] bg-[#111317] p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="text-zinc-400">
                      Selected mode:{" "}
                      <strong className="text-zinc-200 font-medium">
                        {selectedModeMeta.label}
                      </strong>
                    </span>
                    <span className="font-mono font-semibold text-brand-400">
                      Cost: {creditsCost} {creditsCost === 1 ? "credit" : "credits"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={loading}
                    className="w-full py-3.5 px-6 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    <SparklesIcon className="size-4" />
                    <span>
                      {loading
                        ? `Generating (${selectedModeMeta.label})…`
                        : `Generate Thumbnail — ${creditsCost} ${
                            creditsCost === 1 ? "Credit" : "Credits"
                          }`}
                    </span>
                  </button>

                  <p className="text-[11px] text-zinc-500 flex items-center justify-center gap-1.5">
                    <ShieldCheckIcon className="size-3.5 text-emerald-400 shrink-0" />
                    <span>
                      Reserved credits are refunded 100% automatically if generation fails.
                    </span>
                  </p>
                </div>
              )}

              {/* State 2: Completed or Failed Existing Thumbnail */}
              {id && !loading && thumbnail && !thumbnail.isGenerating && (
                <div className="rounded-xl border border-white/[0.08] bg-[#111317] p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={handleGenerate}
                      className="py-3 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 tabular-nums"
                    >
                      <RefreshCwIcon className="size-4" />
                      <span>Regenerate ({creditsCost} cr)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNewGenerate}
                      className="py-3 px-4 rounded-lg bg-[#171a20] hover:bg-white/[0.08] border border-white/[0.1] text-zinc-200 font-medium text-xs sm:text-sm flex items-center justify-center gap-2"
                    >
                      <PlusIcon className="size-4" />
                      <span>New Concept</span>
                    </button>
                  </div>

                  {/* Prompt-based Edit Drawer */}
                  {thumbnail.image_url && (
                    <div className="rounded-lg border border-white/[0.08] bg-[#090a0c] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setEditMode(!editMode);
                          setEditInstructions("");
                        }}
                        className="w-full px-4 py-3 text-xs sm:text-sm font-medium text-zinc-200 hover:bg-white/[0.03] flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <PencilLineIcon className="size-4 text-brand-400" />
                          <span>Edit This Thumbnail with AI</span>
                        </span>
                        <span className="font-mono text-xs text-zinc-400 tabular-nums">
                          {editCreditsCost} cr
                        </span>
                      </button>

                      {editMode && (
                        <div className="p-4 border-t border-white/[0.08] space-y-3">
                          <textarea
                            value={editInstructions}
                            onChange={(e) => setEditInstructions(e.target.value)}
                            rows={3}
                            maxLength={500}
                            placeholder="Describe the change (e.g., make the headline text larger, change background lighting to warm gold)…"
                            className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] bg-[#111317] text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-brand-400 resize-none"
                          />
                          <div className="flex items-center justify-between text-xs text-zinc-500 tabular-nums">
                            <span>{editInstructions.length}/500</span>
                            <span>
                              Consumes{" "}
                              <strong className="text-brand-400">
                                {editCreditsCost}{" "}
                                {editCreditsCost === 1 ? "credit" : "credits"}
                              </strong>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleEdit}
                            disabled={editLoading || !editInstructions.trim()}
                            className="w-full py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2"
                          >
                            <PencilLineIcon className="size-3.5" />
                            <span>
                              {editLoading
                                ? "Applying Edit…"
                                : `Apply Edit — ${editCreditsCost} cr`}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default Generate;
