"use client";
import SectionTitle from "../components/SectionTitle";
import {
  SlidersIcon,
  ShieldCheckIcon,
  ImagePlusIcon,
  Maximize2Icon,
  LayersIcon,
  SparklesIcon,
} from "lucide-react";

const studioCapabilities = [
  {
    icon: LayersIcon,
    title: "Four Verified Generation Modes",
    spec: "1 to 5 credits / job",
    description:
      "Switch between Fastest (1 cr), Standard (2 cr), Best for Text & Reference Photos (3 cr), and Ultra 4K (5 cr) depending on whether you are testing concepts or publishing a final video.",
  },
  {
    icon: Maximize2Icon,
    title: "Verified 2K & True 4K Pixel Output",
    spec: "Up to 5504×3072 px",
    description:
      "Every generated image is inspected by the worker before commit. 2K modes verify at ≥ 2048px wide and Ultra 4K verifies at ≥ 3840px wide.",
  },
  {
    icon: ImagePlusIcon,
    title: "Subject & YouTube Style Referencing",
    spec: "Creator & Pro plans",
    description:
      "Upload a portrait or product photo, or paste any YouTube video URL to guide composition, lighting, and subject placement without manual masking.",
  },
  {
    icon: SlidersIcon,
    title: "Iterative Prompt Editing",
    spec: "In-place refinement",
    description:
      "Request targeted changes to typography, background lighting, or color schemes on any generated thumbnail directly inside the Studio.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Atomic Credit Reservation & Refunds",
    spec: "Zero lost credits",
    description:
      "Credits are reserved atomically when a job enters the queue and committed only after storage succeeds. Any failed or rejected job is refunded 100% automatically.",
  },
  {
    icon: SparklesIcon,
    title: "Fast WebP Gallery & Original Downloads",
    spec: "Instant browsing",
    description:
      "Your gallery loads lightweight WebP previews for instant scrolling while preserving the full-resolution PNG/WebP master for one-click download.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 border-b border-white/[0.08] bg-[#090a0c]">
      <div className="max-w-7xl mx-auto px-6">
        <SectionTitle
          text1="Architecture"
          text2="Built for high-CTR production workflows"
          text3="Every part of ThumbGen is engineered for predictable credit cost, verified output resolution, and fast iteration."
        />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {studioCapabilities.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="rounded-xl border border-white/[0.08] bg-[#111317] p-6 flex flex-col justify-between gap-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="size-9 rounded-lg bg-[#171a20] border border-white/[0.08] flex items-center justify-center text-brand-400">
                      <Icon className="size-4.5" />
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 px-2.5 py-1 rounded-md bg-[#090a0c] border border-white/[0.06] tabular-nums">
                      {item.spec}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-zinc-100">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
