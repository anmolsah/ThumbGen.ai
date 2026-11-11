import type { SectionTitleProps } from "../types";

/**
 * Clean typographic section header (Impeccable craft-floor:
 * no pill eyebrow/kicker badges, no scroll-linked bounce).
 */
export default function SectionTitle({
  text2,
  text3,
}: SectionTitleProps) {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-[-0.025em] text-zinc-100 text-balance">
        {text2}
      </h2>
      {text3 && (
        <p className="text-zinc-400 text-sm sm:text-base mt-3 leading-relaxed max-w-[62ch] mx-auto">
          {text3}
        </p>
      )}
    </div>
  );
}
