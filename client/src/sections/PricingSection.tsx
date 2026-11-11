"use client";
import { useEffect, useState } from "react";
import SectionTitle from "../components/SectionTitle";
import { pricingData } from "../data/pricing";
import type { IPricing } from "../types";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../configs/api";
import toast from "react-hot-toast";

export default function PricingSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [plans, setPlans] = useState<IPricing[]>(pricingData);

  useEffect(() => {
    api
      .get("/api/config/public")
      .then(({ data }) => {
        if (Array.isArray(data?.plans) && data.plans.length > 0) {
          const mapped: IPricing[] = data.plans.map((p: any) => {
            const features: string[] = [
              `${p.credits} Credits`,
              p.marketing_thumbnails_claim,
              p.max_resolution === "4K" ? "Ultra 4K Quality" : "Ultra 2K Quality",
              p.watermark ? "Watermarked" : "No Watermark",
            ];
            if (p.reference_images) {
              features.push("Image Referencing");
            }
            if (p.id === "pro" && p.max_concurrent_jobs) {
              features.push(`Priority Queue (up to ${p.max_concurrent_jobs} concurrent jobs)`);
            }
            return {
              name: p.name,
              price: p.price_usd,
              period: "one-time",
              features,
              mostPopular: Boolean(p.most_popular),
            };
          });
          setPlans(mapped);
        }
      })
      .catch(() => {
        // Fallback to static verified pricingData
      });
  }, []);

  const getPlanType = (planName: string): "starter" | "creator" | "pro" => {
    if (planName.toLowerCase().includes("starter")) return "starter";
    if (planName.toLowerCase().includes("creator")) return "creator";
    return "pro";
  };

  const handlePlanPurchase = async (plan: "starter" | "creator" | "pro") => {
    if (!user) {
      navigate("/login");
      return;
    }

    try {
      setLoading(plan);
      const { data } = await api.post("/api/payment/create-order", { plan });

      if (!data.success || !data.checkoutUrl) {
        toast.error("Failed to create order");
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error?.response?.data?.message || "Payment failed");
    } finally {
      setLoading(null);
    }
  };

  const handlePlanClick = (plan: IPricing) => {
    const planType = getPlanType(plan.name);
    handlePlanPurchase(planType);
  };

  const getButtonText = (plan: IPricing) => {
    const planType = getPlanType(plan.name);

    if (loading === planType) {
      return (
        <span className="inline-flex items-center justify-center gap-2">
          <Loader2Icon className="size-4 animate-spin" />
          <span>Processing…</span>
        </span>
      );
    }

    if (planType === "starter") return "Get Starter — $6";
    if (planType === "creator") return "Get Creator — $29";
    return "Get Pro — $59";
  };

  return (
    <section id="pricing" className="py-24 border-b border-white/[0.08] bg-[#090a0c]">
      <div className="max-w-7xl mx-auto px-6">
        <SectionTitle
          text1="Pricing"
          text2="One-time credit packs. Zero subscriptions."
          text3="Buy credits once and spend them across any unlocked generation mode. Credits never expire."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14 max-w-5xl mx-auto items-stretch">
          {plans.map((plan: IPricing, index: number) => (
            <div
              key={index}
              className={`rounded-xl border p-7 flex flex-col justify-between ${
                plan.mostPopular
                  ? "bg-[#141821] border-brand-500/50"
                  : "bg-[#111317] border-white/[0.08]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h3 className="text-base font-semibold text-zinc-100">
                    {plan.name}
                  </h3>
                  {plan.mostPopular && (
                    <span className="px-2.5 py-0.5 text-[11px] font-medium bg-brand-500/20 text-brand-300 border border-brand-500/30 rounded-md">
                      Recommended
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1.5 pb-6 border-b border-white/[0.08] tabular-nums">
                  <span className="text-4xl font-semibold text-zinc-100 tracking-tight">
                    ${plan.price}
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">
                    / {plan.period}
                  </span>
                </div>

                <ul className="mt-6 space-y-3 text-xs sm:text-sm text-zinc-300">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <CheckIcon className="size-4 text-brand-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => handlePlanClick(plan)}
                disabled={loading !== null}
                className={`w-full py-3 rounded-lg text-xs sm:text-sm font-semibold mt-8 disabled:opacity-50 ${
                  plan.mostPopular
                    ? "bg-zinc-100 text-zinc-950 hover:bg-white"
                    : "bg-[#171a20] hover:bg-white/[0.1] text-zinc-100 border border-white/[0.1]"
                }`}
              >
                {getButtonText(plan)}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
