"use client";
import { useState } from "react";
import SectionTitle from "../components/SectionTitle";
import { pricingData } from "../data/pricing";
import type { IPricing } from "../types";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { load } from "@cashfreepayments/cashfree-js";
import api from "../configs/api";
import toast from "react-hot-toast";

export default function PricingSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

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

      if (!data.success) {
        toast.error("Failed to create order");
        return;
      }

      const cashfreeMode = import.meta.env.PROD ? "production" : "sandbox";
      const cashfree = await load({ mode: cashfreeMode });

      await cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_self",
      });
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
        <>
          <Loader2Icon className="size-5 animate-spin inline mr-2" />
          Processing...
        </>
      );
    }

    if (planType === "starter") return "Get Starter";
    if (planType === "creator") return "Get Creator";
    return "Get Pro";
  };

  return (
    <div id="pricing" className="px-4 md:px-16 lg:px-24 xl:px-32">
      <SectionTitle
        text1="Pricing"
        text2="Simple Pricing"
        text3="Buy credits once, use them anytime. No subscriptions, no expiry."
      />

      <div className="flex flex-wrap items-center justify-center gap-8 mt-20">
        {pricingData.map((plan: IPricing, index: number) => (
          <motion.div
            key={index}
            className={`w-72 text-center border border-brand-800 p-6 pb-16 rounded-xl ${
              plan.mostPopular ? "bg-brand-800 relative" : "bg-brand-900/30"
            }`}
            initial={{ y: 150, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{
              delay: index * 0.15,
              type: "spring",
              stiffness: 320,
              damping: 70,
              mass: 1,
            }}
          >
            {plan.mostPopular && (
              <p className="absolute px-3 text-sm -top-3.5 left-3.5 py-1 bg-brand-500 text-brand-900 rounded-full">
                Most Popular
              </p>
            )}
            <p className="font-semibold">{plan.name}</p>
            <h1 className="text-3xl font-semibold">
              ₹{plan.price}
              <span className="text-gray-500 font-normal text-sm ml-1">
                one-time
              </span>
            </h1>
            <ul className="list-none text-slate-300 mt-6 space-y-2">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <CheckIcon className="size-4.5 text-brand-500" />
                  <p>{feature}</p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => handlePlanClick(plan)}
              disabled={loading !== null}
              className={`w-full py-2.5 rounded-md font-medium mt-7 transition-all disabled:opacity-50 ${
                plan.mostPopular
                  ? "bg-white text-brand-600 hover:bg-slate-200"
                  : "bg-brand-500 hover:bg-brand-600"
              }`}
            >
              {getButtonText(plan)}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
