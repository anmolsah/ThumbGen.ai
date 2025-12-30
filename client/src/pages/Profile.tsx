import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import SoftBackdrop from "../components/SoftBackdrop";
import {
  CrownIcon,
  SparklesIcon,
  ZapIcon,
  Loader2Icon,
  GiftIcon,
} from "lucide-react";
import { load } from "@cashfreepayments/cashfree-js";
import api from "../configs/api";
import toast from "react-hot-toast";

const PLANS = {
  none: {
    name: "No Plan",
    icon: GiftIcon,
    color: "text-gray-400",
    bgColor: "bg-gray-800",
  },
  free: {
    name: "Free Plan",
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
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleActivateFreePlan = async () => {
    try {
      setLoading("free");
      const { data } = await api.post("/api/payment/activate-free");

      if (data.success) {
        setUser(data.user);
        toast.success("Free plan activated! You have 25 credits.");
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

  const handleUpgrade = async (plan: "creator" | "pro") => {
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
      // Initialize Cashfree
      const cashfree = await load({ mode: "sandbox" }); // Change to "production" for live
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

            {/* Credits Section - Only show if user has a plan */}
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
                    : "No credits remaining. Upgrade your plan to continue generating."}
                </p>
              </div>
            )}
          </div>

          {/* Plan Selection for New Users */}
          {hasNoPlan && (
            <div className="mt-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold">Choose Your Plan</h2>
                <p className="text-gray-400 mt-2">
                  Select a plan to start generating AI thumbnails
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Free Plan */}
                <div className="bg-white/6 border border-gray-700 rounded-2xl p-6 hover:border-gray-500 transition">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gray-800 rounded-lg">
                      <SparklesIcon className="size-6 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Free Plan</h3>
                      <p className="text-gray-400 text-sm">Try it out</p>
                    </div>
                  </div>

                  <div className="text-3xl font-bold mb-4">
                    ₹0{" "}
                    <span className="text-gray-500 text-base font-normal">
                      /trial
                    </span>
                  </div>

                  <ul className="space-y-2 mb-6 text-sm text-gray-300">
                    <li>✓ 25 Credits</li>
                    <li>✓ 5 Thumbnails</li>
                    <li>✓ Standard Quality</li>
                    <li className="text-gray-500">✗ Watermarked</li>
                  </ul>

                  <button
                    onClick={handleActivateFreePlan}
                    disabled={loading !== null}
                    className="w-full py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-xl font-medium transition flex items-center justify-center gap-2"
                  >
                    {loading === "free" ? (
                      <>
                        <Loader2Icon className="size-5 animate-spin" />
                        Activating...
                      </>
                    ) : (
                      "Start Free"
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
                      <h3 className="font-bold text-lg">Creator Plan</h3>
                      <p className="text-gray-400 text-sm">For creators</p>
                    </div>
                  </div>

                  <div className="text-3xl font-bold mb-4">
                    ₹299{" "}
                    <span className="text-gray-500 text-base font-normal">
                      /month
                    </span>
                  </div>

                  <ul className="space-y-2 mb-6 text-sm text-gray-300">
                    <li>✓ 200 Credits</li>
                    <li>✓ 40 Thumbnails</li>
                    <li>✓ High Quality</li>
                    <li>✓ No Watermark</li>
                  </ul>

                  <button
                    onClick={() => handleUpgrade("creator")}
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
                      <h3 className="font-bold text-lg">Pro Plan</h3>
                      <p className="text-gray-400 text-sm">For professionals</p>
                    </div>
                  </div>

                  <div className="text-3xl font-bold mb-4">
                    ₹799{" "}
                    <span className="text-gray-500 text-base font-normal">
                      /month
                    </span>
                  </div>

                  <ul className="space-y-2 mb-6 text-sm text-gray-300">
                    <li>✓ 800 Credits</li>
                    <li>✓ 160 Thumbnails</li>
                    <li>✓ Ultra 4K Quality</li>
                    <li>✓ No Watermark</li>
                  </ul>

                  <button
                    onClick={() => handleUpgrade("pro")}
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
          )}

          {/* Upgrade Section for Free Users */}
          {user.plan === "free" && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-6">Upgrade Your Plan</h2>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Creator Plan */}
                <div className="bg-white/6 border border-brand-700 rounded-2xl p-6 hover:border-brand-500 transition">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-brand-800 rounded-lg">
                      <ZapIcon className="size-6 text-brand-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Creator Plan</h3>
                      <p className="text-gray-400 text-sm">
                        For content creators
                      </p>
                    </div>
                  </div>

                  <div className="text-3xl font-bold mb-4">
                    ₹299{" "}
                    <span className="text-gray-500 text-base font-normal">
                      /month
                    </span>
                  </div>

                  <ul className="space-y-2 mb-6 text-sm text-gray-300">
                    <li>✓ 200 Credits</li>
                    <li>✓ 40 Thumbnails</li>
                    <li>✓ High Quality</li>
                    <li>✓ No Watermark</li>
                  </ul>

                  <button
                    onClick={() => handleUpgrade("creator")}
                    disabled={loading !== null}
                    className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-xl font-medium transition flex items-center justify-center gap-2"
                  >
                    {loading === "creator" ? (
                      <>
                        <Loader2Icon className="size-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Upgrade to Creator"
                    )}
                  </button>
                </div>

                {/* Pro Plan */}
                <div className="bg-white/6 border border-amber-800 rounded-2xl p-6 hover:border-amber-600 transition relative overflow-hidden">
                  <div className="absolute top-4 right-4 px-3 py-1 bg-amber-500 text-amber-950 text-xs font-bold rounded-full">
                    BEST VALUE
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-amber-900 rounded-lg">
                      <CrownIcon className="size-6 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Pro Plan</h3>
                      <p className="text-gray-400 text-sm">For professionals</p>
                    </div>
                  </div>

                  <div className="text-3xl font-bold mb-4">
                    ₹799{" "}
                    <span className="text-gray-500 text-base font-normal">
                      /month
                    </span>
                  </div>

                  <ul className="space-y-2 mb-6 text-sm text-gray-300">
                    <li>✓ 800 Credits</li>
                    <li>✓ 160 Thumbnails</li>
                    <li>✓ Ultra 4K Quality</li>
                    <li>✓ No Watermark</li>
                  </ul>

                  <button
                    onClick={() => handleUpgrade("pro")}
                    disabled={loading !== null}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl font-medium transition flex items-center justify-center gap-2"
                  >
                    {loading === "pro" ? (
                      <>
                        <Loader2Icon className="size-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Upgrade to Pro"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Already on Creator plan - show Pro upgrade */}
          {user.plan === "creator" && (
            <div className="mt-8 bg-white/6 border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-2">Upgrade to Pro</h2>
              <p className="text-gray-400 mb-4">
                Get more credits and Ultra 4K quality thumbnails.
              </p>

              <button
                onClick={() => handleUpgrade("pro")}
                disabled={loading !== null}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg font-medium transition flex items-center gap-2"
              >
                {loading === "pro" ? (
                  <>
                    <Loader2Icon className="size-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CrownIcon className="size-5" />
                    Upgrade to Pro - ₹799/month
                  </>
                )}
              </button>
            </div>
          )}

          {/* Pro plan - no upgrade needed */}
          {user.plan === "pro" && (
            <div className="mt-8 bg-white/6 border border-amber-800 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <CrownIcon className="size-8 text-amber-400" />
                <div>
                  <h2 className="text-xl font-bold text-amber-400">
                    You're on Pro!
                  </h2>
                  <p className="text-gray-400">
                    You have access to all premium features and Ultra 4K
                    quality.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Profile;
