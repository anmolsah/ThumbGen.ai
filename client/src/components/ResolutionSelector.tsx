import { ZapIcon, CrownIcon, LockIcon } from "lucide-react";
import type { Resolution } from "../assets/assets";

interface ResolutionSelectorProps {
  value: Resolution;
  onChange: (resolution: Resolution) => void;
  canUse4K?: boolean;
  isPro?: boolean;
}

const ResolutionSelector = ({
  value,
  onChange,
  canUse4K,
  isPro,
}: ResolutionSelectorProps) => {
  const unlocked4K = canUse4K !== undefined ? canUse4K : Boolean(isPro);

  const options = [
    {
      id: "2k" as Resolution,
      label: "2K Standard",
      specs: "2048–2816 px wide",
      icon: <ZapIcon className="size-4" />,
      estimate: "1–3 credits · ~8–25s",
      locked: false,
    },
    {
      id: "4k" as Resolution,
      label: "True 4K Ultra",
      specs: "3840–5504 px wide",
      icon: <CrownIcon className="size-4" />,
      estimate: "5 credits · ~20–35s",
      locked: !unlocked4K,
    },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-zinc-300">
          Output Resolution
        </label>
        <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
          {value === "4k" ? "≥ 3840px verified" : "≥ 2048px verified"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {options.map((option) => {
          const selected = value === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => !option.locked && onChange(option.id)}
              disabled={option.locked}
              className={`relative rounded-lg border p-3 text-left transition-colors ${
                option.locked
                  ? "border-white/[0.06] bg-[#090a0c]/60 opacity-55 cursor-not-allowed"
                  : selected
                  ? "bg-brand-500/[0.12] border-brand-500/50 text-zinc-100"
                  : "border-white/[0.08] bg-[#090a0c] hover:border-white/[0.16] text-zinc-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className={selected ? "text-brand-400" : "text-zinc-400"}>
                    {option.icon}
                  </span>
                  <span className="text-xs font-semibold text-zinc-100">
                    {option.label}
                  </span>
                </div>
                {option.locked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                    <LockIcon className="size-2.5" />
                    Creator/Pro
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-zinc-400 tabular-nums">
                {option.specs}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
                {option.estimate}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ResolutionSelector;
