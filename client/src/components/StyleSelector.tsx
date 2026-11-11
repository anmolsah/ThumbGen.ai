import type React from "react";
import { thumbnailStyles, type ThumbnailStyle } from "../assets/assets";
import {
  CpuIcon,
  ImageIcon,
  PenToolIcon,
  SquareIcon,
  SparkleIcon,
  ChevronDownIcon,
} from "lucide-react";

const StyleSelector = ({
  value,
  onChange,
  isOpen,
  setIsOpen,
}: {
  value: ThumbnailStyle;
  onChange: (style: ThumbnailStyle) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) => {
  const styleDescriptions: Record<ThumbnailStyle, string> = {
    "Bold & Graphic": "High contrast, bold typography, striking focal subject",
    Minimalist: "Clean composition, strong negative space, crisp hierarchy",
    Photorealistic: "Natural camera lighting, realistic skin & environment",
    Illustrated: "Stylized digital illustration, expressive color grading",
    "Tech/Futuristic": "Precision hardware lighting, sleek dark-room aesthetic",
  };

  const styleIcons: Record<ThumbnailStyle, React.ReactNode> = {
    "Bold & Graphic": <SparkleIcon className="size-4 text-brand-400" />,
    Minimalist: <SquareIcon className="size-4 text-brand-400" />,
    Photorealistic: <ImageIcon className="size-4 text-brand-400" />,
    Illustrated: <PenToolIcon className="size-4 text-brand-400" />,
    "Tech/Futuristic": <CpuIcon className="size-4 text-brand-400" />,
  };

  return (
    <div className="relative space-y-2.5">
      <label className="block text-xs font-medium text-zinc-300">
        Visual Style
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition-colors bg-[#090a0c] border-white/[0.08] hover:border-white/[0.16] text-zinc-200"
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
            {styleIcons[value]}
            <span>{value}</span>
          </div>
          <p className="text-[11px] text-zinc-400">{styleDescriptions[value]}</p>
        </div>
        <ChevronDownIcon
          className={[
            "size-4 text-zinc-400 transition-transform duration-150",
            isOpen && "rotate-180",
          ].join(" ")}
        />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-1.5 left-0 z-50 w-full rounded-xl border border-white/[0.12] bg-[#111317] shadow-2xl overflow-hidden divide-y divide-white/[0.06]">
          {thumbnailStyles.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => {
                onChange(style);
                setIsOpen(false);
              }}
              className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.05] ${
                value === style ? "bg-brand-500/[0.1]" : ""
              }`}
            >
              <div className="mt-0.5">{styleIcons[style]}</div>
              <div>
                <p className="text-xs font-semibold text-zinc-100">{style}</p>
                <p className="text-[11px] text-zinc-400">
                  {styleDescriptions[style]}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StyleSelector;
