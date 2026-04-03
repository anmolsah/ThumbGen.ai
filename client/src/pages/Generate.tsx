import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import {
  colorSchemes,
  platforms,
  type AspectRatio,
  type Resolution,
  type IThumbnail,
  type ThumbnailStyle,
} from "../assets/assets";
import SoftBackdrop from "../components/SoftBackdrop";
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
  TypeIcon,
  MonitorIcon,
  PaletteIcon,
  ImagePlusIcon,
} from "lucide-react";

const Generate = () => {
  const { id } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, setUser } = useAuth();

  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");

  const [thumbnail, setThumbnail] = useState<IThumbnail | null>(null);
  const [loading, setLoading] = useState(false);

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [colorSchemeId, setColorSchemeId] = useState<string>(
    colorSchemes[0].id
  );
  const [style, setStyle] = useState<ThumbnailStyle>("Bold & Graphic");

  const [platform, setPlatform] = useState<string>("youtube");
  const [resolution, setResolution] = useState<Resolution>("2k");

  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);

  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [ytThumbnailPreview, setYtThumbnailPreview] = useState<string | null>(null);

  const hasNoPlan = !user || user.plan === "none";
  const hasNoCredits = user && user.credits <= 0;
  const canUploadImage = user?.plan === "creator" || user?.plan === "pro";
  const isPro = user?.plan === "pro";

  // Calculate credits cost based on reference image usage
  const hasReference = (referenceImage && canUploadImage) || (youtubeUrl && canUploadImage);
  const creditsCost = hasReference ? 15 : 5;

  // Extract YouTube video ID from URL
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

  // When platform changes, auto-set the aspect ratio
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

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setReferenceImage(event.target?.result as string);
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
    if (!isLoggedIn) return toast.error("Please login to generate thumbnails");
    if (hasNoPlan) return toast.error("Please select a plan first");
    if (hasNoCredits)
      return toast.error("No credits remaining. Please upgrade your plan.");

    // Validate required fields
    if (!title.trim()) {
      setTitleError("Please enter a title or topic for your thumbnail");
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.error("Title is required to generate a thumbnail");
      return;
    }
    setTitleError("");
    setLoading(true);

    try {
      const api_payload: any = {
        title,
        prompt: additionalDetails,
        style,
        aspect_ratio: aspectRatio,
        color_scheme: colorSchemeId,
        text_overlay: true,
        resolution,
        platform,
        youtube_reference_url: youtubeUrl.trim() || undefined,
      };

      // Add reference image if uploaded (only for paid plans)
      if (referenceImage && canUploadImage) {
        api_payload.reference_image = referenceImage;
      }

      const { data } = await api.post("/api/thumbnail/generate", api_payload);
      if (data.thumbnail) {
        // Update user credits in state
        if (user && data.credits !== undefined) {
          setUser({ ...user, credits: data.credits });
        }
        navigate("/generate/" + data.thumbnail._id);
        toast.success(data.message);
      }
    } catch (error: any) {
      console.log(error);
      toast.error(error?.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset every field to defaults and navigate to the blank generate page
  const handleNewGenerate = () => {
    setTitle("");
    setTitleError("");
    setAdditionalDetails("");
    setStyle("Bold & Graphic");
    setAspectRatio("16:9");
    setColorSchemeId(colorSchemes[0].id);
    setPlatform("youtube");
    setResolution("2k");
    setReferenceImage(null);
    setYoutubeUrl("");
    setYtThumbnailPreview(null);
    setThumbnail(null);
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    navigate("/generate");
  };

  const fetchThumbnail = async () => {
    try {
      const { data } = await api.get(`/api/user/thumbnail/${id}`);
      setThumbnail(data?.thumbnail as IThumbnail);

      const isComplete =
        !data?.thumbnail?.isGenerating && data?.thumbnail?.image_url;
      setLoading(!isComplete);

      // Update credits when thumbnail is fetched (credits deducted after generation)
      if (user && data.credits !== undefined) {
        setUser({
          ...user,
          credits: data.credits,
          totalCredits: data.totalCredits,
        });
      }

      setAdditionalDetails(data?.thumbnail?.user_prompt);
      setTitle(data?.thumbnail?.title);
      setColorSchemeId(data?.thumbnail?.color_scheme);
      setAspectRatio(data?.thumbnail?.aspect_ratio);
      setStyle(data?.thumbnail?.style);
      if (data?.thumbnail?.platform) setPlatform(data.thumbnail.platform);
      if (data?.thumbnail?.resolution) setResolution(data.thumbnail.resolution);
      if (data?.thumbnail?.youtube_reference_url)
        handleYoutubeUrlChange(data.thumbnail.youtube_reference_url);
    } catch (error: any) {
      console.log(error);
      toast.error(error?.response?.data?.message || error.message);
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !id) return;

    // Populate the form fields from the existing thumbnail record
    fetchThumbnail();

    const apiBase =
      import.meta.env.VITE_BASE_URL ||
      (typeof window !== "undefined" && window.location.origin.includes("localhost")
        ? "http://localhost:3000"
        : "");

    // ── SSE connection ────────────────────────────────────────────────────────
    const evtSource = new EventSource(
      `${apiBase}/api/sse/thumbnail/${id}`,
      { withCredentials: true }
    );

    // Track whether SSE already delivered a result so we don't start a
    // redundant fallback interval when the server legitimately closes the
    // stream (which also fires the native onerror event).
    let completed = false;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    const stopFallback = () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

    // Start polling every 4 seconds as a fallback (SSE failure / timeout)
    const startFallback = () => {
      if (fallbackInterval || completed) return;
      fallbackInterval = setInterval(async () => {
        try {
          const { data } = await api.get(`/api/user/thumbnail/${id}`);
          const thumb = data?.thumbnail;
          if (thumb && !thumb.isGenerating && thumb.image_url) {
            setThumbnail(thumb as IThumbnail);
            setLoading(false);
            completed = true;
            stopFallback();
            // Refresh credits
            api.get("/api/auth/verify").then(({ data: d }) => {
              if (d?.user) setUser(d.user);
            }).catch(() => {});
          }
        } catch { /* network error — keep retrying */ }
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
          api.get("/api/auth/verify").then(({ data }) => {
            if (data?.user) setUser(data.user);
          }).catch(() => {});
        }
      } catch {}
      evtSource.close();
    });

    // Server sent timeout (job > 120s) — keep polling
    evtSource.addEventListener("timeout", () => {
      evtSource.close();
      startFallback();
    });

    // Server sent error event — keep polling
    evtSource.addEventListener("error_event", () => {
      evtSource.close();
      startFallback();
    });

    // Native EventSource onerror fires both on real errors AND when the server
    // closes the connection after sending "complete". Guard with `completed`.
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
  }, [id, isLoggedIn]);

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

  // Show plan selection prompt if user has no plan
  if (isLoggedIn && hasNoPlan) {
    return (
      <>
        <SoftBackdrop />
        <div className="pt-24 min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center bg-white/6 border border-white/10 rounded-2xl p-8">
            <div className="size-16 bg-brand-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <SparklesIcon className="size-8 text-brand-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Choose a Plan</h1>
            <p className="text-gray-400 mb-6">
              You need to select a plan before you can start generating AI
              thumbnails.
            </p>
            <Link
              to="/profile"
              className="block w-full py-3 bg-brand-500 hover:bg-brand-600 rounded-xl font-medium transition"
            >
              Select a Plan
            </Link>
          </div>
        </div>
      </>
    );
  }

  // Show credits warning if user has no credits
  if (isLoggedIn && hasNoCredits) {
    return (
      <>
        <SoftBackdrop />
        <div className="pt-24 min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center bg-white/6 border border-amber-800 rounded-2xl p-8">
            <div className="size-16 bg-amber-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircleIcon className="size-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-amber-400">
              No Credits Left
            </h1>
            <p className="text-gray-400 mb-6">
              You've used all your credits. Upgrade your plan to continue
              generating thumbnails.
            </p>
            <Link
              to="/profile"
              className="block w-full py-3 bg-amber-600 hover:bg-amber-700 rounded-xl font-medium transition"
            >
              Upgrade Plan
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title="Generate Thumbnail"
        description="Create your AI-powered YouTube thumbnail. Describe your video, choose a style, and get professional thumbnails in seconds."
        url="https://thumbgen.online/generate"
      />
      
      <div className="min-h-screen bg-black/40 pt-24 relative overflow-hidden">
        {/* Deep ambient glow layer */}
        <div className="fixed inset-0 pointer-events-none z-[-1]">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/10 blur-[150px] rounded-full mix-blend-screen" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-brand-500/5 blur-[150px] rounded-full mix-blend-screen" />
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          
          {/* Header Title Section */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3">AI Studio</h1>
            <p className="text-zinc-400 text-lg max-w-2xl">Shape your vision. Grouped configurations to forge the perfect thumbnail.</p>
          </div>

          <div className="grid lg:grid-cols-[450px_1fr] xl:grid-cols-[500px_1fr] gap-8 xl:gap-12 relative items-start">
            
            {/* ================= LEFT COMMAND CENTER (SCROLLABLE) ================= */}
            <div className={`space-y-6 ${id ? "pointer-events-none opacity-80" : ""}`}>
              
              {/* === CARD 1: CORE CONTENT === */}
              <div className="p-6 rounded-[24px] bg-white/[0.03] border border-white/10 shadow-2xl backdrop-blur-xl">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="p-2 rounded-lg bg-brand-500/20 text-brand-400">
                     <TypeIcon size={20} />
                   </div>
                   <h2 className="text-lg font-bold text-white">Core Concept</h2>
                 </div>

                 <div className="space-y-5">
                   <div className="space-y-2">
                     <label className="block text-sm font-medium text-zinc-300">
                       Title or Topic <span className="text-red-400 text-xs">*</span>
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
                       className={`w-full px-4 py-3.5 rounded-xl border bg-black/40 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 transition-all shadow-inner ${
                         titleError
                           ? "border-red-500 focus:ring-red-500"
                           : "border-white/10 focus:ring-brand-500 hover:border-white/20"
                       }`}
                     />
                     <div className="flex items-center justify-between">
                       {titleError ? (
                         <span className="text-xs text-red-400 flex items-center gap-1"><span>⚠</span> {titleError}</span>
                       ) : <span />}
                       <span className="text-xs text-zinc-500">{title.length}/100</span>
                     </div>
                   </div>

                   <div className="space-y-2">
                     <label className="block text-sm font-medium text-zinc-300">
                       Additional Details <span className="text-zinc-500 text-xs">(optional)</span>
                     </label>
                     <textarea
                       value={additionalDetails}
                       onChange={(e) => setAdditionalDetails(e.target.value)}
                       rows={3}
                       placeholder="Add specific elements, mood, or context..."
                       className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-black/40 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 hover:border-white/20 transition-all resize-none shadow-inner"
                     />
                   </div>
                 </div>
              </div>

              {/* === CARD 2: FORMAT & SIZING === */}
              <div className="p-6 rounded-[24px] bg-white/[0.03] border border-white/10 shadow-2xl backdrop-blur-xl">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="p-2 rounded-lg bg-green-500/20 text-green-400">
                     <MonitorIcon size={20} />
                   </div>
                   <h2 className="text-lg font-bold text-white">Format & Sizing</h2>
                 </div>
                 
                 <div className="space-y-6">
                   <PlatformSelector value={platform} onChange={handlePlatformChange} />
                   <ResolutionSelector value={resolution} onChange={setResolution} isPro={!!isPro} />
                   <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />
                 </div>
              </div>

              {/* === CARD 3: ART DIRECTION === */}
              <div className="p-6 rounded-[24px] bg-white/[0.03] border border-white/10 shadow-2xl backdrop-blur-xl">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                     <PaletteIcon size={20} />
                   </div>
                   <h2 className="text-lg font-bold text-white">Art Direction</h2>
                 </div>
                 
                 <div className="space-y-6">
                   <StyleSelector value={style} onChange={setStyle} isOpen={styleDropdownOpen} setIsOpen={setStyleDropdownOpen} />
                   <ColorSchemeSelector value={colorSchemeId} onChange={setColorSchemeId} />
                 </div>
              </div>

              {/* === CARD 4: ADVANCED CONTEXT === */}
              <div className="p-6 rounded-[24px] bg-white/[0.03] border border-white/10 shadow-2xl backdrop-blur-xl">
                 <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-3">
                     <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                       <ImagePlusIcon size={20} />
                     </div>
                     <h2 className="text-lg font-bold text-white">Advanced References</h2>
                   </div>
                   {!canUploadImage && (
                     <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 bg-amber-500/10 px-2 py-1 rounded">Pro/Creator Only</span>
                   )}
                 </div>

                 <div className="space-y-6">
                   {/* Ref Image Input */}
                   <div className="space-y-3">
                     <div className="flex items-center justify-between">
                       <label className="block text-sm font-medium text-zinc-300">Reference Image<span className="text-zinc-500 text-xs">(optional)</span></label>
                       {canUploadImage && <span className="text-xs font-semibold text-amber-400">+10 credits</span>}
                     </div>

                     {canUploadImage ? (
                       <>
                         <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                         {referenceImage ? (
                           <div className="relative group">
                             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl z-10 flex items-center justify-center">
                               <button onClick={removeReferenceImage} className="p-2 bg-red-500 hover:bg-red-600 rounded-full transition shadow-lg text-white">
                                 <XIcon className="size-5" />
                               </button>
                             </div>
                             <img src={referenceImage} alt="Reference" className="w-full h-40 object-cover rounded-xl border border-white/20 shadow-inner" />
                           </div>
                         ) : (
                           <button onClick={() => fileInputRef.current?.click()} className="w-full py-8 rounded-xl border-2 border-dashed border-white/10 hover:border-brand-500/50 bg-black/20 hover:bg-black/40 transition-all flex flex-col items-center gap-3 group">
                             <UploadIcon className="size-8 text-zinc-500 group-hover:text-brand-400 transition-colors" />
                             <div className="text-center">
                               <span className="block text-sm font-medium text-zinc-300">Click to upload photo</span>
                               <span className="block text-xs text-zinc-500 mt-1">PNG, JPG up to 5MB</span>
                             </div>
                           </button>
                         )}
                       </>
                     ) : (
                       <div className="w-full py-6 rounded-xl border border-white/5 bg-black/20 flex flex-col items-center justify-center gap-2 opacity-50">
                         <ImageIcon className="size-6 text-zinc-600" />
                         <span className="text-xs text-zinc-500 px-4 text-center">Upgrade plan to provide image references</span>
                       </div>
                     )}
                   </div>

                   {/* YT Reference Input */}
                   <div className="space-y-3">
                     <div className="flex items-center justify-between">
                       <label className="block text-sm font-medium text-zinc-300">YouTube Context URL<span className="text-zinc-500 text-xs">(optional)</span></label>
                       {canUploadImage && <span className="text-xs font-semibold text-amber-400">+10 credits</span>}
                     </div>

                     {canUploadImage ? (
                       <div className="space-y-3">
                         <div className="relative group">
                           <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-500 group-focus-within:text-brand-400 transition-colors" />
                           <input
                             type="text"
                             value={youtubeUrl}
                             onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                             placeholder="https://youtube.com/watch?v=..."
                             className="w-full pl-11 pr-10 py-3.5 rounded-xl border border-white/10 bg-black/40 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-inner hover:border-white/20 transition-all"
                           />
                           {youtubeUrl && (
                             <button onClick={clearYoutubeUrl} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
                               <XIcon className="size-4" />
                             </button>
                           )}
                         </div>
                         {ytThumbnailPreview && (
                           <div className="rounded-xl overflow-hidden border border-white/10 relative">
                             <div className="absolute inset-x-0 bottom-0 py-2 bg-gradient-to-t from-black/80 to-transparent">
                               <p className="text-[11px] font-medium text-center text-zinc-300 drop-shadow">Style Context Sample</p>
                             </div>
                             <img src={ytThumbnailPreview} alt="YouTube thumbnail preview" className="w-full h-28 object-cover" />
                           </div>
                         )}
                       </div>
                     ) : (
                       <div className="w-full py-4 rounded-xl border border-white/5 bg-black/20 flex items-center justify-center gap-2 opacity-50">
                         <LinkIcon className="size-4 text-zinc-600" />
                         <span className="text-xs text-zinc-500 text-center">Upgrade plan for YouTube reference</span>
                       </div>
                     )}
                   </div>
                 </div>
              </div>

            </div>

            {/* ================= RIGHT STICKY PREVIEW ================= */}
            <div className="sticky top-24 pb-8 space-y-6">
              
              {/* Credits HUD Header */}
              {user && (
                <div className="flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 backdrop-blur-xl shadow-lg">
                  <div className="flex items-center gap-3 text-zinc-300">
                     <span className="flex size-2 bg-brand-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(61,143,202,0.8)]" /> 
                     Available Credits
                  </div>
                  <span className="font-black text-brand-400 text-lg tabular-nums">
                    {user.credits} <span className="text-zinc-600 font-medium text-sm">/ {user.totalCredits}</span>
                  </span>
                </div>
              )}

              {/* Interactive Preview Element */}
              <div className="rounded-[32px] p-2 bg-white/[0.03] border border-white/10 shadow-2xl backdrop-blur-xl">
                 <div className="rounded-[24px] overflow-hidden bg-black relative">
                   {/* Preview component nested directly inside the stylized frame */}
                   <PreviewPanel thumbnail={thumbnail} isLoading={loading} aspectRatio={aspectRatio} />
                 </div>
              </div>

              {/* ── CTA area ── three states ─────────────────────────── */}

              {/* State 1: blank form — show the master Generate button */}
              {!id && (
                <div className="pt-2">
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="w-full overflow-hidden relative group bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed text-white font-black text-xl rounded-2xl px-8 py-5 shadow-[0_0_30px_rgba(61,143,202,0.3)] hover:shadow-[0_0_40px_rgba(61,143,202,0.5)] transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                    <span className="relative z-10 flex items-center justify-center gap-3 tracking-wide">
                      {loading ? (
                        resolution === "4k" ? (
                          <><span>👑</span> Generating Premium...</>
                        ) : (
                          <><span>⚡</span> Generating...</>
                        )
                      ) : (
                        <><SparklesIcon size={24} /> GENERATE THUMBNAIL</>
                      )}
                    </span>
                  </button>
                  <p className="text-center text-sm font-medium text-zinc-500 mt-4 px-4 bg-white/5 py-2 rounded-xl inline-block w-full border border-white/5">
                    Consumes: <span className="text-brand-400">{creditsCost} credits</span>
                    {hasReference && <span className="text-zinc-400"> (incl. ref)</span>}
                    {resolution === "4k" && <span className="text-amber-400"> + 4K Upgrade</span>}
                  </p>
                </div>
              )}

              {/* State 2: thumbnail done — Regenerate + New Generate */}
              {id && !loading && thumbnail && !thumbnail.isGenerating && thumbnail.image_url && (
                <div className="pt-2 space-y-3">
                  {/* Regenerate — same settings, new job */}
                  <button
                    onClick={handleGenerate}
                    className="w-full overflow-hidden relative group bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-base rounded-2xl px-8 py-4 shadow-[0_0_30px_rgba(61,143,202,0.25)] hover:shadow-[0_0_40px_rgba(61,143,202,0.45)] transition-all duration-300 hover:-translate-y-0.5"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                    <span className="relative z-10 flex items-center justify-center gap-2.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                      Regenerate
                    </span>
                  </button>

                  {/* New Generate — clear everything */}
                  <button
                    onClick={handleNewGenerate}
                    className="w-full relative group border border-white/15 hover:border-white/30 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 font-bold text-base rounded-2xl px-8 py-4 transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <span className="flex items-center justify-center gap-2.5">
                      <SparklesIcon size={18} />
                      New Generate
                    </span>
                  </button>

                  <p className="text-center text-xs text-zinc-600 pt-1">
                    Regenerate uses <span className="text-brand-400">{creditsCost} credits</span> with the same settings
                  </p>
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
