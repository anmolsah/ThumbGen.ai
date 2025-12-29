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
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const getPlanType = (planName: string): "free" | "creator" | "pro" => {
    if (planName.toLowerCase().includes("free")) return "free";
    if (planName.toLowerCase().includes("creator")) return "creator";
    return "pro";
  };

  const handleFreePlan = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    // Check if user already has a plan (handle undefined/null as "none")
    if (user.plan && user.plan !== "none") {
      toast.error("You already have an active plan");
      navigate("/profile");
      return;
    }

    try {
      setLoading("free");
      const { data } = await api.post("/api/payment/activate-free");

      if (data.success) {
        setUser(data.user);
        toast.success("Free plan activated! You have 25 credits.");
        navigate("/generate");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.response?.data?.message || "Failed to activate free plan"
      );
    } finally {
      setLoading(null);
    }
  };

  const handlePaidPlan = async (plan: "creator" | "pro") => {
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

      const cashfree = await load({ mode: "sandbox" });

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

    if (planType === "free") {
      handleFreePlan();
    } else {
      handlePaidPlan(planType);
    }
  };

  const getButtonText = (plan: IPricing) => {
    const planType = getPlanType(plan.name);

    if (loading === planType) {
      return (
        <>
          <Loader2Icon className="size-5 animate-spin inline mr-2" />
          {planType === "free" ? "Activating..." : "Processing..."}
        </>
      );
    }

    // Show "Current Plan" if user already has this plan
    if (user?.plan === planType) return "Current Plan";

    if (planType === "free") return "Start Free";
    if (planType === "creator") return "Get Creator";
    return "Get Pro";
  };

  return (
    <div id="pricing" className="px-4 md:px-16 lg:px-24 xl:px-32">
      <SectionTitle
        text1="Pricing"
        text2="Simple Pricing"
        text3="Choose the plan that fits your creation schedule. Cancel anytime."
      />

      <div className="flex flex-wrap items-center justify-center gap-8 mt-20">
        {pricingData.map((plan: IPricing, index: number) => (
          <motion.div
            key={index}
            className={`w-72 text-center border border-teal-900 p-6 pb-16 rounded-xl ${
              plan.mostPopular ? "bg-teal-900 relative" : "bg-teal-950/30"
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
              <p className="absolute px-3 text-sm -top-3.5 left-3.5 py-1 bg-teal-400 text-teal-950 rounded-full">
                Most Popular
              </p>
            )}
            <p className="font-semibold">{plan.name}</p>
            <h1 className="text-3xl font-semibold">
              {plan.price === 0 ? "Free" : `₹${plan.price}`}
              {plan.price > 0 && (
                <span className="text-gray-500 font-normal text-sm">
                  /{plan.period}
                </span>
              )}
            </h1>
            <ul className="list-none text-slate-300 mt-6 space-y-2">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <CheckIcon className="size-4.5 text-teal-400" />
                  <p>{feature}</p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => handlePlanClick(plan)}
              disabled={
                loading !== null || user?.plan === getPlanType(plan.name)
              }
              className={`w-full py-2.5 rounded-md font-medium mt-7 transition-all disabled:opacity-50 ${
                plan.mostPopular
                  ? "bg-white text-teal-600 hover:bg-slate-200"
                  : "bg-teal-500 hover:bg-teal-600"
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
