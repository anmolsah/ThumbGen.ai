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
    if (isLoggedIn && id) {
      fetchThumbnail();
    }
    if (id && loading && isLoggedIn) {
      const interval = setInterval(() => {
        fetchThumbnail();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [id, loading, isLoggedIn]);

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
      <SoftBackdrop />
      <div className="pt-24 min-h-screen">
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 lg:pb-8">
          {/* Credits indicator */}
          {user && (
            <div className="mb-6 flex items-center justify-between bg-white/6 border border-white/10 rounded-xl px-4 py-3">
              <span className="text-sm text-gray-400">Credits remaining</span>
              <span className="font-bold text-brand-400">
                {user.credits} / {user.totalCredits}
              </span>
            </div>
          )}

          <div className="grid lg:grid-cols-[400px_1fr] gap-8">
            {/* LEFT PANEL */}
            <div className={`space-y-6 ${id && "pointer-events-none"}`}>
              <div className="p-6 rounded-2xl bg-white/8 border border-white/12 shadow-xl space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100 mb-1">
                    Create Your Thumbnail
                  </h2>
                  <p className="text-sm text-zinc-400">
                    Describe your vision and let AI bring it to life
                  </p>
                </div>

                <div className="space-y-5">
                  {/* TITLE INPUT */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">
                      Title or Topic{" "}
                      <span className="text-red-400 text-xs">*</span>
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
                      className={`w-full px-4 py-3 rounded-lg border bg-black/20 text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 transition-colors ${
                        titleError
                          ? "border-red-500 focus:ring-red-500"
                          : "border-white/12 focus:ring-brand-500"
                      }`}
                    />
                    <div className="flex items-center justify-between">
                      {titleError ? (
                        <span className="text-xs text-red-400 flex items-center gap-1">
                          <span>⚠</span> {titleError}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="text-xs text-zinc-400">
                        {title.length}/100
                      </span>
                    </div>
                  </div>

                  {/* PlatformSelector */}
                  <PlatformSelector
                    value={platform}
                    onChange={handlePlatformChange}
                  />

                  {/* ResolutionSelector */}
                  <ResolutionSelector
                    value={resolution}
                    onChange={setResolution}
                    isPro={!!isPro}
                  />

                  {/* AspectRatioSelector */}
                  <AspectRatioSelector
                    value={aspectRatio}
                    onChange={setAspectRatio}
                  />

                  {/* StyleSelector */}
                  <StyleSelector
                    value={style}
                    onChange={setStyle}
                    isOpen={styleDropdownOpen}
                    setIsOpen={setStyleDropdownOpen}
                  />

                  {/* ColorSchemeSelector */}
                  <ColorSchemeSelector
                    value={colorSchemeId}
                    onChange={setColorSchemeId}
                  />

                  {/* DETAILS */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">
                      Additional Prompts{" "}
                      <span className="text-zinc-400 text-xs">(optional)</span>
                    </label>
                    <textarea
                      value={additionalDetails}
                      onChange={(e) => setAdditionalDetails(e.target.value)}
                      rows={3}
                      placeholder="Add any specific elements, mood, or style preferences..."
                      className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/6  text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    />
                  </div>

                  {/* Reference Image Upload - Only for Creator and Pro plans */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium">
                        Reference Image{" "}
                        <span className="text-zinc-400 text-xs">
                          {canUploadImage
                            ? "(optional)"
                            : "(Creator & Pro only)"}
                        </span>
                      </label>
                      {canUploadImage && (
                        <span className="text-xs text-amber-400">
                          +10 credits
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
                          <div className="relative">
                            <img
                              src={referenceImage}
                              alt="Reference"
                              className="w-full h-32 object-cover rounded-lg border border-white/10"
                            />
                            <button
                              onClick={removeReferenceImage}
                              className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 rounded-full transition"
                            >
                              <XIcon className="size-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-6 rounded-lg border-2 border-dashed border-white/20 hover:border-brand-500/50 bg-white/5 hover:bg-white/8 transition flex flex-col items-center gap-2"
                          >
                            <UploadIcon className="size-6 text-zinc-400" />
                            <span className="text-sm text-zinc-400">
                              Upload your photo to include in thumbnail
                            </span>
                            <span className="text-xs text-zinc-500">
                              PNG, JPG up to 5MB
                            </span>
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="w-full py-4 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center gap-2 opacity-60">
                        <ImageIcon className="size-5 text-zinc-500" />
                        <span className="text-sm text-zinc-500">
                          Upgrade to Creator or Pro to upload reference images
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Reference YouTube URL - Creator & Pro */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium">
                        Reference YouTube URL{" "}
                        <span className="text-zinc-400 text-xs">
                          {canUploadImage
                            ? "(optional)"
                            : "(Creator & Pro only)"}
                        </span>
                      </label>
                      {canUploadImage && (
                        <span className="text-xs text-amber-400">
                          +10 credits
                        </span>
                      )}
                    </div>

                    {canUploadImage ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                          <input
                            type="text"
                            value={youtubeUrl}
                            onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                            placeholder="https://youtube.com/watch?v=..."
                            className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-white/12 bg-black/20 text-zinc-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          {youtubeUrl && (
                            <button
                              onClick={clearYoutubeUrl}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-white/10 rounded"
                            >
                              <XIcon className="size-3.5 text-zinc-400" />
                            </button>
                          )}
                        </div>
                        {ytThumbnailPreview && (
                          <div className="rounded-lg overflow-hidden border border-white/10">
                            <img
                              src={ytThumbnailPreview}
                              alt="YouTube thumbnail preview"
                              className="w-full h-24 object-cover"
                            />
                            <p className="text-[10px] text-zinc-500 px-2 py-1 bg-white/5">
                              Will copy this thumbnail's style
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full py-3 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center gap-2 opacity-60">
                        <LinkIcon className="size-4 text-zinc-500" />
                        <span className="text-xs text-zinc-500">
                          Upgrade to Creator or Pro for YouTube URL reference
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* BUTTON */}
                {!id && (
                  <div className="space-y-2">
                    <button
                      onClick={handleGenerate}
                      disabled={loading}
                      className="text-[15px] w-full py-3.5 rounded-xl font-medium bg-linear-to-b from-brand-500 to-brand-600 hover:from-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading
                        ? resolution === "4k"
                          ? "👑 Premium generating... ~30–45s"
                          : "⚡ Generating..."
                        : "Generate Thumbnail"}
                    </button>
                    <p className="text-center text-xs text-zinc-500">
                      This will use{" "}
                      <span className="text-brand-400 font-medium">
                        {creditsCost} credits
                      </span>
                      {hasReference && (
                        <span className="text-zinc-600">
                          {" "}
                          (includes reference)
                        </span>
                      )}
                      {resolution === "4k" && (
                        <span className="text-amber-400/70">
                          {" "}
                          · 4K Premium Quality
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {/* RIGHT PANEL */}
            <div>
              <div className="p-6 rounded-2xl bg-white/8 border border-white/10 shadow-xl">
                <h2 className="text-lg font-semibold text-zinc-100 mb-4">
                  Preview
                </h2>
                <PreviewPanel
                  thumbnail={thumbnail}
                  isLoading={loading}
                  aspectRatio={aspectRatio}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default Generate;
