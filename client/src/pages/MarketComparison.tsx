import { motion } from "motion/react";
import {
  TrendingDownIcon,
  CheckCircleIcon,
  ZapIcon,
  CrownIcon,
  SparklesIcon,
  ShieldCheckIcon,
  BadgePercentIcon,
  ArrowRightIcon,
  Wand2Icon,
  PaintbrushIcon,
  BotIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SoftBackdrop from "../components/SoftBackdrop";
import SEO from "../components/SEO";

/* ─── Data: savings vs each competitor ─── */
const savingsData: {
  competitor: string;
  Icon: LucideIcon;
  iconBg: string;
  savingsRange: string;
  savingsLabel: string;
  description: string;
  barPercent: number;
  gradient: string;
}[] = [
  {
    competitor: "Midjourney",
    Icon: Wand2Icon,
    iconBg: "from-purple-500 to-fuchsia-600",
    savingsRange: "60–76%",
    savingsLabel: "Save up to 76%",
    description: "Midjourney charges ₹30–₹50 per image. With ThumbGen you pay a fraction of that.",
    barPercent: 76,
    gradient: "from-purple-500 to-fuchsia-500",
  },
  {
    competitor: "Canva AI",
    Icon: PaintbrushIcon,
    iconBg: "from-blue-500 to-cyan-600",
    savingsRange: "41–55%",
    savingsLabel: "Save up to 55%",
    description: "Canva AI starts at ₹20+. ThumbGen delivers 4K thumbnails for much less.",
    barPercent: 55,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    competitor: "ThumbnailAI Tools",
    Icon: BotIcon,
    iconBg: "from-orange-500 to-amber-600",
    savingsRange: "21–70%",
    savingsLabel: "Save up to 70%",
    description: "Generic thumbnail AI tools cost ₹15–₹40. ThumbGen undercuts them all.",
    barPercent: 70,
    gradient: "from-orange-500 to-amber-500",
  },
];

const planSavings = [
  { plan: "Starter", perThumb: "₹11.80", savings: "Up to 76% cheaper", tag: null },
  { plan: "Creator", perThumb: "₹17.47", savings: "Up to 65% cheaper", tag: "BEST VALUE" },
  { plan: "Pro", perThumb: "₹18.70", savings: "Up to 63% cheaper", tag: null },
];

const whyWins = [
  {
    icon: BadgePercentIcon,
    title: "2-3× Cheaper",
    desc: "Pay a fraction of what competitors charge per thumbnail.",
    gradient: "from-emerald-400 to-green-500",
  },
  {
    icon: ZapIcon,
    title: "Ultra 4K Quality",
    desc: "High-resolution output that looks stunning on any screen.",
    gradient: "from-amber-400 to-orange-500",
  },
  {
    icon: ShieldCheckIcon,
    title: "One-Time Payment",
    desc: "No subscriptions. Buy credits once, use them anytime.",
    gradient: "from-blue-400 to-cyan-500",
  },
  {
    icon: SparklesIcon,
    title: "Zero Design Skills",
    desc: "Just describe your video — AI handles the rest.",
    gradient: "from-purple-400 to-pink-500",
  },
];

// Animation variants
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const fadeUp = {
  hidden: { y: 28, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 120, damping: 14 },
  },
};

export default function MarketComparison() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  const handleGetStarted = () => {
    navigate(isLoggedIn ? "/generate" : "/login");
  };

  return (
    <>
      <SEO
        title="Market Comparison – ThumbGen Pricing"
        description="See how much you save with ThumbGen compared to Midjourney, Canva AI, and other thumbnail tools. Up to 76% cheaper."
      />
      <SoftBackdrop />

      <div className="min-h-screen pt-24 sm:pt-28 md:pt-32 pb-16 md:pb-20 px-4 sm:px-6 md:px-16 lg:px-24 xl:px-32">
        <div className="max-w-6xl mx-auto">

          {/* ═══════════ HERO ═══════════ */}
          <motion.div
            className="text-center mb-14 sm:mb-18 md:mb-22"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-5"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <TrendingDownIcon className="size-4 text-emerald-400" />
              <span className="text-emerald-400 text-xs sm:text-sm font-medium">
                Up to 76% Cheaper
              </span>
            </motion.div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              Save More with{" "}
              <span className="bg-gradient-to-r from-brand-400 to-cyan-400 bg-clip-text text-transparent">
                ThumbGen
              </span>
            </h1>
            <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
              See exactly how much you save compared to every major competitor —
              no hidden fees, no subscriptions.
            </p>
          </motion.div>

          {/* ═══════════ SAVINGS vs COMPETITORS ═══════════ */}
          <motion.div
            className="mb-14 sm:mb-18"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-7">
              <div className="size-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                <TrendingDownIcon className="size-5 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold">Your Savings vs Competitors</h2>
            </div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-5"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {savingsData.map((item) => (
                <motion.div
                  key={item.competitor}
                  variants={fadeUp}
                  whileHover={{ scale: 1.04, y: -6 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative rounded-2xl p-6 bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-all duration-300 overflow-hidden group"
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />

                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`size-10 rounded-xl bg-gradient-to-br ${item.iconBg} flex items-center justify-center shrink-0`}>
                        <item.Icon className="size-5 text-white" />
                      </div>
                      <p className="font-semibold text-white text-lg">vs {item.competitor}</p>
                    </div>

                    {/* Big savings number */}
                    <motion.p
                      className={`text-4xl sm:text-5xl font-extrabold bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent mb-1`}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.5, type: "spring", stiffness: 150 }}
                    >
                      {item.savingsRange}
                    </motion.p>
                    <p className="text-emerald-400 text-sm font-medium mb-3">{item.savingsLabel}</p>

                    {/* Visual bar */}
                    <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${item.gradient}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${item.barPercent}%` }}
                        transition={{ delay: 0.7, duration: 1, ease: "easeOut" }}
                      />
                    </div>

                    <p className="text-gray-500 text-xs mt-3">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* ═══════════ PLAN-LEVEL SAVINGS ═══════════ */}
          <motion.div
            className="mb-14 sm:mb-18"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-7">
              <div className="size-10 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center">
                <CrownIcon className="size-5 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold">Savings By Plan</h2>
            </div>

            <motion.div
              className="grid grid-cols-1 sm:grid-cols-3 gap-5"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {planSavings.map((item) => (
                <motion.div
                  key={item.plan}
                  variants={fadeUp}
                  whileHover={{ scale: 1.04, y: -6 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative rounded-2xl p-6 border transition-all duration-300 overflow-hidden group ${
                    item.tag
                      ? "bg-gradient-to-br from-brand-500/15 to-cyan-500/10 border-brand-500/40 shadow-[0_0_40px_-12px_rgba(61,143,202,0.25)]"
                      : "bg-white/5 border-white/10 hover:border-white/20"
                  }`}
                >
                  {item.tag && (
                    <motion.div
                      className="absolute -top-1 right-4 bg-gradient-to-r from-brand-500 to-cyan-500 text-white text-[10px] sm:text-xs font-bold px-3 py-1 rounded-b-lg"
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.6, type: "spring" }}
                    >
                      {item.tag}
                    </motion.div>
                  )}

                  <div className="relative z-10">
                    <p className="text-gray-400 text-sm font-medium mb-1">{item.plan} Plan</p>
                    <p className="text-emerald-400 text-xl sm:text-2xl font-bold mb-1">
                      {item.savings}
                    </p>
                    <p className="text-gray-500 text-xs">
                      at just {item.perThumb} per thumbnail
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* ═══════════ ANIMATED SAVINGS BAR CHART ═══════════ */}
          <motion.div
            className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 mb-14 sm:mb-18 overflow-hidden"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-2">
              How Much You Keep in Your Pocket
            </h2>
            <p className="text-gray-500 text-sm text-center mb-8">
              Percentage saved vs each competitor
            </p>

            <div className="space-y-5 max-w-2xl mx-auto">
              {savingsData.map((item, i) => (
                <div key={item.competitor} className="flex items-center gap-3 sm:gap-4">
                  <span className="text-xs sm:text-sm text-gray-400 w-28 sm:w-32 text-right shrink-0 truncate">
                    vs {item.competitor}
                  </span>
                  <div className="flex-1 h-9 sm:h-10 bg-white/5 rounded-full overflow-hidden relative">
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${item.gradient} flex items-center justify-end pr-3 sm:pr-4`}
                      initial={{ width: 0 }}
                      animate={{ width: `${item.barPercent}%` }}
                      transition={{ delay: 0.7 + i * 0.15, duration: 1, ease: "easeOut" }}
                    >
                      <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap drop-shadow">
                        Save {item.savingsRange}
                      </span>
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ═══════════ WHY THUMBGEN WINS ═══════════ */}
          <motion.div
            className="mb-16 sm:mb-20"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-8">
              Why ThumbGen Wins
            </h2>

            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {whyWins.map((adv) => (
                <motion.div
                  key={adv.title}
                  variants={fadeUp}
                  whileHover={{ scale: 1.03, y: -3 }}
                  className="flex items-start gap-4 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-5 transition-all group"
                >
                  <div
                    className={`size-11 sm:size-12 rounded-xl bg-gradient-to-br ${adv.gradient} flex items-center justify-center shrink-0 group-hover:shadow-lg transition-shadow`}
                  >
                    <adv.icon className="size-5 sm:size-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircleIcon className="size-4 text-emerald-400 shrink-0" />
                      <span className="text-white font-semibold">{adv.title}</span>
                    </div>
                    <p className="text-gray-400 text-sm">{adv.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* ═══════════ BIG SAVINGS BADGE ═══════════ */}
          <motion.div
            className="relative text-center mb-16 sm:mb-20"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.7, type: "spring", stiffness: 120 }}
          >
            {/* Pulsing glow */}
            <motion.div
              className="absolute inset-0 mx-auto w-56 h-56 sm:w-72 sm:h-72 rounded-full bg-gradient-to-r from-emerald-500/20 via-brand-500/20 to-cyan-500/20 blur-3xl"
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="relative inline-flex flex-col items-center bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-3xl px-10 sm:px-14 py-10 sm:py-12 backdrop-blur-sm">
              <motion.div
                className="text-5xl sm:text-7xl font-extrabold bg-gradient-to-r from-emerald-400 via-cyan-400 to-brand-400 bg-clip-text text-transparent"
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                style={{ backgroundSize: "200% 200%" }}
              >
                2-3×
              </motion.div>
              <p className="text-emerald-400 font-semibold text-lg sm:text-xl mt-2">
                Cheaper Than Market
              </p>
              <p className="text-gray-500 text-sm mt-1">
                Across every plan, every competitor
              </p>
            </div>
          </motion.div>

          {/* ═══════════ CTA ═══════════ */}
          <motion.div
            className="text-center"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Ready to Save?
            </h2>
            <p className="text-gray-400 text-sm sm:text-base mb-6 sm:mb-8 max-w-md mx-auto">
              Start generating professional thumbnails at a fraction of the cost.
            </p>
            <motion.button
              onClick={handleGetStarted}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-cyan-500 hover:from-brand-600 hover:to-cyan-600 text-white font-semibold px-7 sm:px-9 py-3 sm:py-3.5 rounded-full transition-all text-sm sm:text-base shadow-lg shadow-brand-500/20"
              whileHover={{ scale: 1.06, boxShadow: "0 0 30px rgba(61,143,202,0.35)" }}
              whileTap={{ scale: 0.96 }}
            >
              <SparklesIcon className="size-4 sm:size-5" />
              Start Generating Now
              <ArrowRightIcon className="size-4 sm:size-5" />
            </motion.button>
          </motion.div>
        </div>
      </div>
    </>
  );
}
