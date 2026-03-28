import { Zap, Crown } from "lucide-react";
import type { Resolution } from "../assets/assets";

interface ResolutionSelectorProps {
  value: Resolution;
  onChange: (resolution: Resolution) => void;
  isPro: boolean;
}

const ResolutionSelector = ({
  value,
  onChange,
  isPro,
}: ResolutionSelectorProps) => {
  const options = [
    {
      id: "2k" as Resolution,
      label: "2K",
      badge: "Fast",
      icon: <Zap className="size-4" />,
      estimate: "~5–12 sec",
      description: "Grok AI — fast generation",
      locked: false,
    },
    {
      id: "4k" as Resolution,
      label: "4K",
      badge: "Premium",
      icon: <Crown className="size-4" />,
      estimate: "~30–45 sec",
      description: "Imagen Ultra — best quality",
      locked: !isPro,
    },
  ];

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-200">
        Resolution
      </label>

      <div className="flex gap-2">
        {options.map((option) => {
          const selected = value === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => !option.locked && onChange(option.id)}
              disabled={option.locked}
              className={`flex-1 relative rounded-lg border px-4 py-3 text-sm transition ${
                option.locked
                  ? "border-white/6 opacity-50 cursor-not-allowed"
                  : selected
                  ? "bg-brand-500/15 border-brand-500/40 ring-1 ring-brand-500/20"
                  : "border-white/10 hover:bg-white/6"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={
                    selected ? "text-brand-400" : "text-zinc-400"
                  }
                >
                  {option.icon}
                </span>
                <span className="font-semibold text-zinc-100">
                  {option.label}
                </span>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    option.id === "2k"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {option.badge}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">{option.estimate}</p>
              {option.locked && (
                <span className="absolute top-2 right-2 text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  Pro 
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ResolutionSelector;
