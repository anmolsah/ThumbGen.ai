import {
  RectangleHorizontal,
  RectangleVertical,
  Square,
  Columns2,
  Rows2,
} from "lucide-react";
import { aspectRatios, type AspectRatio } from "../assets/assets";
import type React from "react";

const AspectRatioSelector = ({
  value,
  onChange,
}: {
  value: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
}) => {
  const iconMap: Record<string, React.ReactNode> = {
    "16:9": <RectangleHorizontal className="size-4" />,
    "1:1": <Square className="size-4" />,
    "9:16": <RectangleVertical className="size-4" />,
    "4:5": <Columns2 className="size-4" />,
    "2:3": <RectangleVertical className="size-4" />,
    "1.91:1": <Rows2 className="size-4" />,
  };

  return (
    <div className="space-y-2.5">
      <label className="block text-xs font-medium text-zinc-300">
        Aspect Ratio
      </label>

      <div className="grid grid-cols-3 gap-2">
        {aspectRatios.map((ratio) => {
          const selected = value === ratio;

          return (
            <button
              key={ratio}
              type="button"
              onClick={() => onChange(ratio)}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-mono tabular-nums transition-colors ${
                selected
                  ? "bg-brand-500/[0.12] border-brand-500/50 text-zinc-100 font-semibold"
                  : "border-white/[0.08] bg-[#090a0c] hover:border-white/[0.16] text-zinc-400"
              }`}
            >
              {iconMap[ratio] || <RectangleHorizontal className="size-4" />}
              <span>{ratio}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AspectRatioSelector;
