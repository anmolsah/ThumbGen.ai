import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import {
  colorSchemes,
  type AspectRatio,
  type IThumbnail,
  type ThumbnailStyle,
} from "../assets/assets";
import SoftBackdrop from "../components/SoftBackdrop";
import AspectRatioSelector from "../components/AspectRatioSelector";
import StyleSelector from "../components/StyleSelector";
import ColorSchemeSelector from "../components/ColorSchemeSelector";
import PreviewPanel from "../components/PreviewPanel";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import api from "../configs/api";
import {
  SparklesIcon,
  AlertCircleIcon,
  UploadIcon,
  XIcon,
  ImageIcon,
} from "lucide-react";

const Generate = () => {
  const { id } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, setUser } = useAuth();

  const [title, setTitle] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");

  const [thumbnail, setThumbnail] = useState<IThumbnail | null>(null);
  const [loading, setLoading] = useState(false);

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [colorSchemeId, setColorSchemeId] = useState<string>(
    colorSchemes[0].id
  );
  const [style, setStyle] = useState<ThumbnailStyle>("Bold & Graphic");

  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);

  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasNoPlan = !user || user.plan === "none";
  const hasNoCredits = user && user.credits <= 0;
  const canUploadImage = user?.plan === "creator" || user?.plan === "pro";

  // Calculate credits cost based on reference image usage
  const creditsCost = referenceImage && canUploadImage ? 15 : 5;

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
    if (!title.trim()) return toast.error("Title is required");
    setLoading(true);

    try {
      const api_payload: any = {
        title,
        prompt: additionalDetails,
        style,
        aspect_ratio: aspectRatio,
        color_scheme: colorSchemeId,
        text_overlay: true,
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
      setLoading(!data?.thumbnail?.image_url);
      setAdditionalDetails(data?.thumbnail?.user_prompt);
      setTitle(data?.thumbnail?.title);
      setColorSchemeId(data?.thumbnail?.color_scheme);
      setAspectRatio(data?.thumbnail?.aspect_ratio);
      setStyle(data?.thumbnail?.style);
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
                      Title or Topic
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={100}
                      placeholder="e.g., 10 Tips for Better Sleep"
                      className="w-full px-4 py-3 rounded-lg border border-white/12  bg-black/20  text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <div className="flex justify-end">
                      <span className="text-xs text-zinc-400">
                        {title.length}/100
                      </span>
                    </div>
                  </div>
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
                </div>

                {/* BUTTON */}
                {!id && (
                  <div className="space-y-2">
                    <button
                      onClick={handleGenerate}
                      disabled={loading}
                      className="text-[15px] w-full py-3.5 rounded-xl font-medium bg-linear-to-b from-brand-500 to-brand-600 hover:from-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? "Generating..." : "Generate Thumbnail"}
                    </button>
                    <p className="text-center text-xs text-zinc-500">
                      This will use{" "}
                      <span className="text-brand-400 font-medium">
                        {creditsCost} credits
                      </span>
                      {referenceImage && canUploadImage && (
                        <span className="text-zinc-600">
                          {" "}
                          (includes reference image)
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
