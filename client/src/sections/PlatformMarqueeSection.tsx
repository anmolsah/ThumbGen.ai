import { platforms } from "../assets/assets";
import { PlatformIcons } from "../components/PlatformSelector";
import SectionTitle from "../components/SectionTitle";

export default function PlatformSection() {
  return (
    <section className="py-24 border-b border-white/[0.08] bg-[#090a0c]">
      <div className="max-w-7xl mx-auto px-6">
        <SectionTitle
          text1="Formats"
          text2="Native aspect ratios for every platform"
          text3="Select your target destination once. ThumbGen configures the exact aspect ratio, framing composition, and pixel dimensions automatically."
        />

        <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border-t border-l border-white/[0.08] rounded-xl overflow-hidden">
          {platforms.map((platform) => (
            <div
              key={platform.id}
              className="p-5 bg-[#111317]/60 hover:bg-[#171a20] border-r border-b border-white/[0.08] transition-colors duration-150 flex flex-col justify-between gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-lg bg-[#090a0c] border border-white/[0.08] flex items-center justify-center">
                  {PlatformIcons[platform.id]}
                </div>
                <span className="text-[11px] font-mono text-zinc-400 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] tabular-nums">
                  {platform.aspectRatio}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {platform.label}
                </h3>
                <p className="text-xs font-mono text-zinc-500 mt-0.5 tabular-nums">
                  {platform.dimensions} base
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
