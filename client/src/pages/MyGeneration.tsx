import { useEffect, useState } from "react";
import { type IThumbnail } from "../assets/assets";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRightIcon, DownloadIcon, TrashIcon, PlusIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../configs/api";
import toast from "react-hot-toast";

const MyGeneration = () => {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const aspectRatioClassMap: Record<string, string> = {
    "16:9": "aspect-video",
    "1:1": "aspect-square",
    "9:16": "aspect-[9/16]",
    "4:5": "aspect-[4/5]",
    "2:3": "aspect-[2/3]",
    "1.91:1": "aspect-[1.91/1]",
  };

  const [thumbnails, setThumbnails] = useState<IThumbnail[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchThumbnails = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/user/thumbnails");
      setThumbnails(data.thumbnails || []);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (thumbId: string, image_url: string) => {
    const apiBase =
      import.meta.env.VITE_BASE_URL ||
      (typeof window !== "undefined" &&
      window.location.origin.includes("localhost")
        ? "http://localhost:3000"
        : "");
    const link = document.createElement("a");
    link.href = thumbId
      ? `${apiBase}/api/thumbnail/export/${thumbId}?variant=master`
      : image_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDelete = async (id: string) => {
    try {
      const confirm = window.confirm(
        "Are you sure you want to delete this thumbnail?"
      );
      if (!confirm) return;
      const { data } = await api.delete(`/api/thumbnail/delete/${id}`);
      toast.success(data.message);
      setThumbnails(thumbnails.filter((t) => t._id !== id));
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || error.message);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchThumbnails();
    } else {
      setThumbnails([]);
    }
  }, [isLoggedIn]);

  return (
    <div className="pt-28 pb-20 min-h-screen bg-[#090a0c] px-6">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-white/[0.08]">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-100">
              Generated Thumbnails
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Fast WebP previews for browsing; click Download for full-resolution masters.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/generate")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs sm:text-sm self-start sm:self-auto"
          >
            <PlusIcon className="size-4" />
            <span>New Thumbnail</span>
          </button>
        </div>

        {/* SKELETON LOADING */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl bg-[#111317] border border-white/[0.08] animate-pulse h-[260px]"
              />
            ))}
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && thumbnails.length === 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-[#111317] text-center py-20 px-6 max-w-md mx-auto">
            <h3 className="text-base font-semibold text-zinc-100">
              No thumbnails generated yet
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 mb-6">
              Open the Studio to create your first 2K or true 4K thumbnail.
            </p>
            <button
              type="button"
              onClick={() => navigate("/generate")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs sm:text-sm"
            >
              <PlusIcon className="size-4" />
              <span>Open Studio</span>
            </button>
          </div>
        )}

        {/* GALLERY GRID */}
        {!loading && thumbnails.length > 0 && (
          <div className="columns-1 sm:columns-2 lg:columns-3 2xl:columns-4 gap-6">
            {thumbnails.map((thumb: IThumbnail) => {
              const aspectClass =
                aspectRatioClassMap[thumb.aspect_ratio || "16:9"] || "aspect-video";
              const displaySrc = thumb.preview_webp_url || thumb.image_url;

              return (
                <div
                  key={thumb._id}
                  onClick={() => navigate(`/generate/${thumb._id}`)}
                  className="mb-6 group relative cursor-pointer rounded-xl bg-[#111317] border border-white/[0.08] hover:border-white/[0.18] transition-colors overflow-hidden break-inside-avoid"
                >
                  {/* IMAGE */}
                  <div
                    className={`relative overflow-hidden ${aspectClass} bg-[#090a0c]`}
                  >
                    {displaySrc ? (
                      <img
                        src={displaySrc}
                        alt={thumb.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                        {thumb.isGenerating ? "Rendering…" : "Failed / No image"}
                      </div>
                    )}

                    {thumb.isGenerating && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs font-medium text-zinc-200">
                        Rendering…
                      </div>
                    )}
                  </div>

                  {/* METADATA */}
                  <div className="p-4 space-y-2.5 border-t border-white/[0.06]">
                    <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 line-clamp-1">
                      {thumb.title}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-zinc-400 tabular-nums">
                      <span className="px-2 py-0.5 rounded bg-[#090a0c] border border-white/[0.06]">
                        {thumb.style}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#090a0c] border border-white/[0.06]">
                        {thumb.aspect_ratio || "16:9"}
                      </span>
                      {thumb.resolution && (
                        <span className="px-2 py-0.5 rounded bg-[#090a0c] border border-white/[0.06] uppercase">
                          {thumb.resolution}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px] text-zinc-500 tabular-nums">
                        {thumb.createdAt
                          ? new Date(thumb.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </p>

                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1"
                      >
                        {thumb.image_url && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                handleDownload(thumb._id, thumb.image_url!)
                              }
                              aria-label="Download full-resolution thumbnail"
                              className="p-1.5 rounded-md bg-[#090a0c] border border-white/[0.08] text-zinc-300 hover:text-white hover:border-white/[0.2]"
                            >
                              <DownloadIcon className="size-3.5" />
                            </button>
                            <Link
                              target="_blank"
                              to={`/preview?thumbnail_url=${encodeURIComponent(
                                thumb.image_url
                              )}&title=${encodeURIComponent(thumb.title)}`}
                              aria-label="Preview in YouTube layout"
                              className="p-1.5 rounded-md bg-[#090a0c] border border-white/[0.08] text-zinc-300 hover:text-white hover:border-white/[0.2]"
                            >
                              <ArrowUpRightIcon className="size-3.5" />
                            </Link>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(thumb._id)}
                          aria-label="Delete thumbnail"
                          className="p-1.5 rounded-md bg-[#090a0c] border border-white/[0.08] text-zinc-400 hover:text-red-400 hover:border-red-500/30"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyGeneration;
