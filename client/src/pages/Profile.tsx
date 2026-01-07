import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import SoftBackdrop from "../components/SoftBackdrop";
import {
  CrownIcon,
  SparklesIcon,
  ZapIcon,
  Loader2Icon,
  RocketIcon,
} from "lucide-react";
import { load } from "@cashfreepayments/cashfree-js";
import api from "../configs/api";
import toast from "react-hot-toast";

const PLANS = {
  none: {
    name: "No Plan",
    icon: RocketIcon,
    color: "text-gray-400",
    bgColor: "bg-gray-800",
  },
  starter: {
    name: "Starter Plan",
    icon: SparklesIcon,
    color: "text-gray-400",
    bgColor: "bg-gray-800",
  },
  creator: {
    name: "Creator Plan",
    icon: ZapIcon,
    color: "text-brand-400",
    bgColor: "bg-brand-800",
  },
  pro: {
    name: "Pro Plan",
    icon: CrownIcon,
    color: "text-amber-400",
    bgColor: "bg-amber-900",
  },
};

const Profile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handlePurchase = async (plan: "starter" | "creator" | "pro") => {
    try {
      setLoading(plan);
      console.log("Creating order for plan:", plan);

      // Create order
      const { data } = await api.post("/api/payment/create-order", { plan });
      console.log("Order response:", data);

      if (!data.success) {
        toast.error("Failed to create order");
        return;
      }

      console.log("Loading Cashfree SDK...");
      // Initialize Cashfree - use production mode based on environment
      const cashfreeMode = import.meta.env.PROD ? "production" : "sandbox";
      const cashfree = await load({ mode: cashfreeMode });
      console.log("Cashfree SDK loaded:", cashfree);

      console.log("Opening checkout with sessionId:", data.paymentSessionId);
      // Open payment checkout
      const checkoutResult = await cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_self",
      });
      console.log("Checkout result:", checkoutResult);
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error?.response?.data?.message || "Payment failed");
    } finally {
      setLoading(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Please login to view your profile</p>
      </div>
    );
  }

  const currentPlan = PLANS[user.plan || "none"];
  const PlanIcon = currentPlan.icon;
  const creditsPercentage =
    user.totalCredits > 0 ? (user.credits / user.totalCredits) * 100 : 0;
  const hasNoPlan = user.plan === "none";

  return (
    <>
      <SoftBackdrop />
      <div className="min-h-screen pt-24 px-4 md:px-16 lg:px-24 xl:px-32 pb-20">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="bg-white/6 border border-white/10 rounded-2xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Avatar */}
              <div className="size-20 rounded-full bg-brand-600 flex items-center justify-center text-3xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>

              {/* User Info */}
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white">{user.name}</h1>
                <p className="text-gray-400">{user.email}</p>

                {/* Current Plan Badge */}
                <div
                  className={`inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full ${currentPlan.bgColor}`}
                >
                  <PlanIcon className={`size-5 ${currentPlan.color}`} />
                  <span className={`font-medium ${currentPlan.color}`}>
                    {currentPlan.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Credits Section - Only show if user has credits */}
            {!hasNoPlan && (
              <div className="mt-8 p-6 bg-black/20 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Credits</h3>
                  <span className="text-2xl font-bold text-brand-400">
                    {user.credits}{" "}
                    <span className="text-gray-500 text-base font-normal">
                      / {user.totalCredits}
                    </span>
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-brand-300 rounded-full transition-all duration-500"
                    style={{ width: `${creditsPercentage}%` }}
                  />
                </div>

                <p className="text-sm text-gray-500 mt-2">
                  {user.credits > 0
                    ? `You can generate approximately ${Math.floor(
                        user.credits / 5
                      )} more thumbnails`
                    : "No credits remaining. Buy more credits to continue generating."}
                </p>
              </div>
            )}
          </div>

          {/* Buy Credits Section */}
          <div className="mt-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold">
                {hasNoPlan ? "Get Started" : "Buy More Credits"}
              </h2>
              <p className="text-gray-400 mt-2">
                {hasNoPlan
                  ? "Choose a plan to start generating AI thumbnails"
                  : "Top up your credits anytime. No expiry!"}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Starter Plan */}
              <div className="bg-white/6 border border-gray-700 rounded-2xl p-6 hover:border-gray-500 transition">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gray-800 rounded-lg">
                    <SparklesIcon className="size-6 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Starter</h3>
                    <p className="text-gray-400 text-sm">Get started</p>
                  </div>
                </div>

                <div className="text-3xl font-bold mb-4">
                  ₹59{" "}
                  <span className="text-gray-500 text-base font-normal">
                    one-time
                  </span>
                </div>

                <ul className="space-y-2 mb-6 text-sm text-gray-300">
                  <li>✓ 25 Credits</li>
                  <li>✓ 5 Thumbnails</li>
                  <li>✓ Ultra 4K Quality</li>
                  <li className="text-gray-500">✗ Watermarked</li>
                </ul>

                <button
                  onClick={() => handlePurchase("starter")}
                  disabled={loading !== null}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-xl font-medium transition flex items-center justify-center gap-2"
                >
                  {loading === "starter" ? (
                    <>
                      <Loader2Icon className="size-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Get Starter"
                  )}
                </button>
              </div>

              {/* Creator Plan */}
              <div className="bg-white/6 border border-brand-700 rounded-2xl p-6 hover:border-brand-500 transition relative">
                <div className="absolute top-4 right-4 px-3 py-1 bg-brand-500 text-brand-900 text-xs font-bold rounded-full">
                  POPULAR
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-brand-800 rounded-lg">
                    <ZapIcon className="size-6 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Creator</h3>
                    <p className="text-gray-400 text-sm">For creators</p>
                  </div>
                </div>

                <div className="text-3xl font-bold mb-4">
                  ₹699{" "}
                  <span className="text-gray-500 text-base font-normal">
                    one-time
                  </span>
                </div>

                <ul className="space-y-2 mb-6 text-sm text-gray-300">
                  <li>✓ 200 Credits</li>
                  <li>✓ 40 Thumbnails</li>
                  <li>✓ Ultra 4K Quality</li>
                  <li>✓ No Watermark</li>
                </ul>

                <button
                  onClick={() => handlePurchase("creator")}
                  disabled={loading !== null}
                  className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-xl font-medium transition flex items-center justify-center gap-2"
                >
                  {loading === "creator" ? (
                    <>
                      <Loader2Icon className="size-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Get Creator"
                  )}
                </button>
              </div>

              {/* Pro Plan */}
              <div className="bg-white/6 border border-amber-800 rounded-2xl p-6 hover:border-amber-600 transition relative">
                <div className="absolute top-4 right-4 px-3 py-1 bg-amber-500 text-amber-950 text-xs font-bold rounded-full">
                  BEST VALUE
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-amber-900 rounded-lg">
                    <CrownIcon className="size-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Pro</h3>
                    <p className="text-gray-400 text-sm">For professionals</p>
                  </div>
                </div>

                <div className="text-3xl font-bold mb-4">
                  ₹2999{" "}
                  <span className="text-gray-500 text-base font-normal">
                    one-time
                  </span>
                </div>

                <ul className="space-y-2 mb-6 text-sm text-gray-300">
                  <li>✓ 800 Credits</li>
                  <li>✓ 160 Thumbnails</li>
                  <li>✓ Ultra 4K Quality</li>
                  <li>✓ No Watermark</li>
                </ul>

                <button
                  onClick={() => handlePurchase("pro")}
                  disabled={loading !== null}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl font-medium transition flex items-center justify-center gap-2"
                >
                  {loading === "pro" ? (
                    <>
                      <Loader2Icon className="size-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Get Pro"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Profile;
