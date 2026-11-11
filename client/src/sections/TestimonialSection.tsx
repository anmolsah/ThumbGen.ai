import SectionTitle from "../components/SectionTitle";
import { GENERATION_MODES } from "../assets/assets";
import { ZapIcon, SparklesIcon, ImagePlusIcon, CrownIcon, ShieldCheckIcon } from "lucide-react";

export default function TestimonialSection() {
  const modeIcons = {
    fast: ZapIcon,
    standard: SparklesIcon,
    premium: ImagePlusIcon,
    ultra: CrownIcon,
  };

  return (
    <section id="modes" className="py-24 border-b border-white/[0.08] bg-[#090a0c]">
      <div className="max-w-7xl mx-auto px-6">
        <SectionTitle
          text1="Modes"
          text2="Transparent credit cost per generation mode"
          text3="Pick the exact balance of speed, typography accuracy, reference photo support, and 4K resolution before every click."
        />

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {GENERATION_MODES.map((mode) => {
            const Icon = modeIcons[mode.id];
            return (
              <div
                key={mode.id}
                className="rounded-xl border border-white/[0.08] bg-[#111317] p-6 flex flex-col justify-between gap-6"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="size-9 rounded-lg bg-[#171a20] border border-white/[0.08] flex items-center justify-center text-brand-400">
                      <Icon className="size-4.5" />
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-brand-500/15 text-brand-300 border border-brand-500/30 tabular-nums">
                      {mode.credits} {mode.credits === 1 ? "credit" : "credits"}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-zinc-100 mb-1.5">
                    {mode.label}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {mode.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/[0.08] space-y-2 text-[11px] font-mono text-zinc-400 tabular-nums">
                  <div className="flex items-center justify-between">
                    <span>MAX OUTPUT</span>
                    <span className="text-zinc-200">{mode.defaultResolution.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>EST. TIME</span>
                    <span className="text-zinc-200">{mode.estimate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>PLANS</span>
                    <span className="text-zinc-200 uppercase">
                      {mode.allowedPlans.join(" / ")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-xl border border-white/[0.08] bg-[#111317]/70 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-300">
          <div className="flex items-center gap-2.5">
            <ShieldCheckIcon className="size-4 text-emerald-400 shrink-0" />
            <span>
              <strong className="text-zinc-100 font-semibold">Guaranteed Resolution &amp; Automatic Refunds:</strong>{" "}
              If any provider fails or returns a lower resolution than your mode guarantees, fallback or credit adjustment happens automatically.
            </span>
          </div>
          <span className="font-mono text-[11px] text-zinc-400 tabular-nums shrink-0">
            1–5 CREDITS / GEN
          </span>
        </div>
      </div>
    </section>
  );
}
