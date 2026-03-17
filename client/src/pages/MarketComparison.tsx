import { motion } from "motion/react";
import {
  TrendingDownIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  ArrowRightIcon,
  Wand2Icon,
  PaintbrushIcon,
  BotIcon,
  ZapIcon,
  ShieldCheckIcon,
  BadgePercentIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SoftBackdrop from "../components/SoftBackdrop";
import SEO from "../components/SEO";

/* ─── Comparison table data ─── */
const competitors = [
  {
    name: "ThumbGen",
    Icon: SparklesIcon,
    iconBg: "from-brand-500 to-cyan-500",
    priceLabel: "₹11 – ₹19",
    subscription: false,
    quality: "Ultra 4K",
    noWatermark: true,
    designSkills: false,
    isUs: true,
  },
  {
    name: "Midjourney",
    Icon: Wand2Icon,
    iconBg: "from-purple-500 to-fuchsia-600",
    priceLabel: "₹30 – ₹50",
    subscription: true,
    quality: "High",
    noWatermark: true,
    designSkills: true,
    isUs: false,
  },
  {
    name: "Canva AI",
    Icon: PaintbrushIcon,
    iconBg: "from-blue-500 to-cyan-600",
    priceLabel: "₹20+",
    subscription: true,
    quality: "Medium",
    noWatermark: false,
    designSkills: true,
    isUs: false,
  },
  {
    name: "ThumbnailAI",
    Icon: BotIcon,
    iconBg: "from-orange-500 to-amber-600",
    priceLabel: "₹15 – ₹40",
    subscription: true,
    quality: "Medium",
    noWatermark: false,
    designSkills: false,
    isUs: false,
  },
];

/* ─── Savings cards ─── */
const savings = [
  {
    vs: "Midjourney",
    Icon: Wand2Icon,
    iconBg: "from-purple-500 to-fuchsia-500",
    save: "Up to 76% cheaper",
    bar: 76,
  },
  {
    vs: "Canva AI",
    Icon: PaintbrushIcon,
    iconBg: "from-blue-500 to-cyan-500",
    save: "Up to 55% cheaper",
    bar: 55,
  },
  {
    vs: "ThumbnailAI",
    Icon: BotIcon,
    iconBg: "from-orange-500 to-amber-500",
    save: "Up to 70% cheaper",
    bar: 70,
  },
];

/* ─── Feature rows for the table ─── */
const features = [
  { label: "Price / thumbnail", key: "priceLabel", isText: true },
  { label: "Monthly subscription", key: "subscription", isText: false, invert: true },
  { label: "Output quality", key: "quality", isText: true },
  { label: "No watermark", key: "noWatermark", isText: false, invert: false },
  { label: "No design skills needed", key: "designSkills", isText: false, invert: true },
] as const;

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const fadeUp = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 130, damping: 15 } },
};

export default function MarketComparison() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  return (
    <>
      <SEO
        title="Market Comparison – ThumbGen"
        description="Compare ThumbGen thumbnail pricing vs Midjourney, Canva AI and other tools. Save up to 76% per thumbnail."
      />
      <SoftBackdrop />

      <div className="min-h-screen pt-24 sm:pt-28 md:pt-32 pb-16 md:pb-20 px-4 sm:px-6 md:px-16 lg:px-24 xl:px-32">
        <div className="max-w-5xl mx-auto">

          {/* ── Header ── */}
          <motion.div
            className="text-center mb-12 sm:mb-16"
            initial={{ y: 36, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.55 }}
          >
            <motion.span
              className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-4 py-1.5 mb-5 text-emerald-400 text-xs sm:text-sm font-medium"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
            >
              <TrendingDownIcon className="size-4" />
              Up to 76% cheaper than competitors
            </motion.span>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
              How We Compare
            </h1>
            <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto">
              Side-by-side comparison so you can decide for yourself.
            </p>
          </motion.div>

          {/* ── Comparison Table ── */}
          <motion.div
            className="mb-14 sm:mb-18 overflow-x-auto rounded-2xl border border-white/10"
            initial={{ y: 36, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-5 py-4 text-gray-400 font-medium w-40">Feature</th>
                  {competitors.map((c) => (
                    <th key={c.name} className={`px-4 py-4 text-center ${c.isUs ? "bg-brand-500/10" : ""}`}>
                      <div className="flex flex-col items-center gap-2">
                        <div className={`size-9 rounded-xl bg-gradient-to-br ${c.iconBg} flex items-center justify-center`}>
                          <c.Icon className="size-4 text-white" />
                        </div>
                        <span className={`font-semibold ${c.isUs ? "text-brand-300" : "text-white"}`}>
                          {c.name}
                        </span>
                        {c.isUs && (
                          <span className="bg-brand-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            YOU
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((feat, fi) => (
                  <motion.tr
                    key={feat.key}
                    className={`border-b border-white/5 ${fi % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 + fi * 0.07, duration: 0.4 }}
                  >
                    <td className="px-5 py-4 text-gray-400">{feat.label}</td>
                    {competitors.map((c) => {
                      const val = c[feat.key as keyof typeof c];
                      return (
                        <td
                          key={c.name}
                          className={`px-4 py-4 text-center ${c.isUs ? "bg-brand-500/10" : ""}`}
                        >
                          {feat.isText ? (
                            <span className={`font-semibold ${c.isUs ? "text-emerald-400 text-base" : "text-white"}`}>
                              {val as string}
                            </span>
                          ) : (
                            (() => {
                              const good = feat.invert ? !val : val;
                              return good ? (
                                <CheckCircleIcon className={`size-5 mx-auto ${c.isUs ? "text-emerald-400" : "text-emerald-500/60"}`} />
                              ) : (
                                <XCircleIcon className="size-5 mx-auto text-red-500/60" />
                              );
                            })()
                          )}
                        </td>
                      );
                    })}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* ── Savings Cards ── */}
          <motion.div
            className="mb-14 sm:mb-18"
            initial={{ y: 36, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
          >
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-7">
              How Much You Save
            </h2>

            <motion.div
              className="grid grid-cols-1 sm:grid-cols-3 gap-5"
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              {savings.map((s, i) => (
                <motion.div
                  key={s.vs}
                  variants={fadeUp}
                  whileHover={{ scale: 1.04, y: -5 }}
                  className="bg-white/5 border border-white/10 hover:border-emerald-500/30 rounded-2xl p-5 transition-all"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`size-10 rounded-xl bg-gradient-to-br ${s.iconBg} flex items-center justify-center shrink-0`}>
                      <s.Icon className="size-5 text-white" />
                    </div>
                    <span className="text-gray-300 text-sm font-medium">vs {s.vs}</span>
                  </div>

                  <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mb-3">
                    {s.save}
                  </p>

                  {/* Progress bar */}
                  <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${s.iconBg}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${s.bar}%` }}
                      transition={{ delay: 0.6 + i * 0.15, duration: 1, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-gray-600 text-xs mt-2">{s.bar}% cheaper per thumbnail</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* ── Why block ── */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14 sm:mb-18"
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            {[
              { Icon: BadgePercentIcon, label: "2-3× cheaper", sub: "Lowest price per thumbnail" },
              { Icon: ZapIcon, label: "Ultra 4K Quality", sub: "No compromise on output" },
              { Icon: ShieldCheckIcon, label: "No subscription", sub: "Pay once, use anytime" },
            ].map((w) => (
              <motion.div
                key={w.label}
                variants={fadeUp}
                whileHover={{ scale: 1.04, y: -4 }}
                className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4 transition-all"
              >
                <div className="size-10 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center shrink-0">
                  <w.Icon className="size-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{w.label}</p>
                  <p className="text-gray-500 text-xs">{w.sub}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* ── CTA ── */}
          <motion.div
            className="text-center"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.45 }}
          >
            <p className="text-gray-400 text-sm sm:text-base mb-5">
              Get the same (or better) quality — at a fraction of the price.
            </p>
            <motion.button
              onClick={() => navigate(isLoggedIn ? "/generate" : "/login")}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-cyan-500 hover:from-brand-600 hover:to-cyan-600 text-white font-semibold px-7 py-3 rounded-full transition-all text-sm sm:text-base shadow-lg shadow-brand-500/20"
              whileHover={{ scale: 1.06, boxShadow: "0 0 30px rgba(61,143,202,0.35)" }}
              whileTap={{ scale: 0.96 }}
            >
              <SparklesIcon className="size-4" />
              Start Saving Now
              <ArrowRightIcon className="size-4" />
            </motion.button>
          </motion.div>
        </div>
      </div>
    </>
  );
}
