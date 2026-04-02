import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import SoftBackdrop from "../components/SoftBackdrop";
import {
  CrownIcon,
  SparklesIcon,
  ZapIcon,
  Loader2Icon,
  RocketIcon,
  UserIcon,
  TvIcon,
  EditIcon,
  CheckIcon,
  XIcon,
  ImageIcon,
  ShoppingBagIcon,
} from "lucide-react";
import api from "../configs/api";
import toast from "react-hot-toast";
import { load } from "@cashfreepayments/cashfree-js";
import { createAvatar } from "@dicebear/core";
import { lorelei } from "@dicebear/collection";

const PLANS = {
  none: {
    name: "No Plan",
    icon: RocketIcon,
    color: "text-gray-400",
    bgColor: "bg-gray-800/60",
    border: "border-gray-700",
  },
  starter: {
    name: "Starter Plan",
    icon: SparklesIcon,
    color: "text-gray-300",
    bgColor: "bg-gray-800/60",
    border: "border-gray-600",
  },
  creator: {
    name: "Creator Plan",
    icon: ZapIcon,
    color: "text-brand-400",
    bgColor: "bg-brand-900/40",
    border: "border-brand-700",
  },
  pro: {
    name: "Pro Plan",
    icon: CrownIcon,
    color: "text-amber-400",
    bgColor: "bg-amber-950/40",
    border: "border-amber-800",
  },
};

const PLAN_CARDS = [
  {
    id: "starter" as const,
    name: "Starter",
    tagline: "Just getting started",
    price: "$6",
    icon: SparklesIcon,
    iconColor: "text-gray-400",
    iconBg: "bg-gray-800",
    border: "border-gray-700 hover:border-gray-500",
    btn: "bg-gray-700 hover:bg-gray-600",
    badge: null,
    badgeStyle: "",
    features: ["25 Credits", "5 Thumbnails", "2K Quality", "Watermarked"],
    featureFlags: [true, true, true, false],
  },
  {
    id: "creator" as const,
    name: "Creator",
    tagline: "For serious creators",
    price: "$29",
    icon: ZapIcon,
    iconColor: "text-brand-400",
    iconBg: "bg-brand-900",
    border: "border-brand-700 hover:border-brand-400",
    btn: "bg-brand-500 hover:bg-brand-600",
    badge: "POPULAR",
    badgeStyle: "bg-brand-500 text-brand-950",
    features: ["200 Credits", "40 Thumbnails", "Ultra 4K Quality", "No Watermark"],
    featureFlags: [true, true, true, true],
  },
  {
    id: "pro" as const,
    name: "Pro",
    tagline: "For professionals",
    price: "$59",
    icon: CrownIcon,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-950",
    border: "border-amber-800 hover:border-amber-500",
    btn: "bg-amber-600 hover:bg-amber-700",
    badge: "BEST VALUE",
    badgeStyle: "bg-amber-500 text-amber-950",
    features: ["400 Credits", "80 Thumbnails", "Ultra 4K Quality", "No Watermark"],
    featureFlags: [true, true, true, true],
  },
];

const Profile = () => {
  const { user, setUser } = useAuth();
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);

  // Edit profile states
  const [editingField, setEditingField] = useState<"name" | "channel" | null>(null);
  const [editName, setEditName] = useState("");
  const [editChannel, setEditChannel] = useState("");
  const [saving, setSaving] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);

  const startEdit = (field: "name" | "channel") => {
    setEditingField(field);
    if (field === "name") setEditName(user?.name || "");
    else setEditChannel(user?.channelName || "");
  };

  const cancelEdit = () => setEditingField(null);

  const saveEdit = async () => {
    if (!editingField) return;
    setSaving(true);
    try {
      const payload =
        editingField === "name"
          ? { name: editName }
          : { channelName: editChannel };
      const { data } = await api.put("/api/user/profile", payload);
      if (data.user && user) {
        setUser({ ...user, ...data.user });
      }
      toast.success(data.message);
      setEditingField(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const generateNewAvatar = async () => {
    setIsGeneratingAvatar(true);
    const newSeed = Math.random().toString(36).substring(7);
    try {
      const { data } = await api.put("/api/user/profile", { avatar: newSeed });
      if (data.user && user) {
        setUser({ ...user, ...data.user });
      }
      toast.success("Avatar updated!");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to update avatar");
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handlePurchase = async (plan: "starter" | "creator" | "pro") => {
    try {
      setPurchaseLoading(plan);
      const { data } = await api.post("/api/payment/create-order", { plan });
      if (!data.success) {
        toast.error("Failed to create order");
        return;
      }
      const cashfreeMode = data.environment || (import.meta.env.PROD ? "production" : "sandbox");
      const cashfree = await load({ mode: cashfreeMode });
      await cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_self",
      });
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error?.response?.data?.message || "Payment failed");
    } finally {
      setPurchaseLoading(null);
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
    user.totalCredits > 0 ? Math.min((user.credits / user.totalCredits) * 100, 100) : 0;
  const hasNoPlan = user.plan === "none";
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const avatarImg = user.avatar ? createAvatar(lorelei, { seed: user.avatar }).toDataUri() : null;

  return (
    <>
      <SoftBackdrop />
      <div className="min-h-screen pt-24 px-4 md:px-10 lg:px-16 xl:px-24 pb-24">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* ── PROFILE HEADER CARD ── */}
          <div className="relative overflow-hidden bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
            {/* Glow accent */}
            <div className="absolute -top-16 -right-16 w-60 h-60 rounded-full bg-brand-600/20 blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Avatar */}
              <div className="relative shrink-0 group">
                {avatarImg ? (
                  <img src={avatarImg} alt="Avatar" className="size-24 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-900/50 object-cover" />
                ) : (
                  <div className="size-24 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-4xl font-bold text-white shadow-lg shadow-brand-900/50">
                    {initials}
                  </div>
                )}
                
                <button 
                  onClick={generateNewAvatar}
                  disabled={isGeneratingAvatar}
                  title="Generate New Avatar"
                  className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 disabled:opacity-50"
                >
                  {isGeneratingAvatar ? <Loader2Icon className="size-6 text-white animate-spin" /> : <SparklesIcon className="size-6 text-white" />}
                </button>

                <div
                  className={`absolute -bottom-2 -right-2 p-1.5 rounded-full border-2 border-zinc-900 ${currentPlan.bgColor}`}
                >
                  <PlanIcon className={`size-3.5 ${currentPlan.color}`} />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-3">
                {/* Name */}
                <div className="flex items-center gap-2 group">
                  {editingField === "name" ? (
                    <div className="flex items-center gap-2 w-full max-w-sm">
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xl font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <button onClick={saveEdit} disabled={saving} className="p-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 transition disabled:opacity-50">
                        {saving ? <Loader2Icon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
                      </button>
                      <button onClick={cancelEdit} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition">
                        <XIcon className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-2xl font-bold text-white truncate">{user.name}</h1>
                      <button
                        onClick={() => startEdit("name")}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-white/10 transition"
                        title="Edit name"
                      >
                        <EditIcon className="size-3.5 text-zinc-400" />
                      </button>
                    </>
                  )}
                </div>

                {/* Email */}
                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                  <UserIcon className="size-4 shrink-0" />
                  <span>{user.email}</span>
                </div>

                {/* Channel name */}
                <div className="flex items-center gap-2 group">
                  <TvIcon className="size-4 shrink-0 text-zinc-500" />
                  {editingField === "channel" ? (
                    <div className="flex items-center gap-2 flex-1 max-w-xs">
                      <input
                        autoFocus
                        value={editChannel}
                        onChange={(e) => setEditChannel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                        placeholder="Your channel or creator name"
                        className="flex-1 px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <button onClick={saveEdit} disabled={saving} className="p-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 transition disabled:opacity-50">
                        {saving ? <Loader2Icon className="size-3.5 animate-spin" /> : <CheckIcon className="size-3.5" />}
                      </button>
                      <button onClick={cancelEdit} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition">
                        <XIcon className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-zinc-400 truncate">
                        {user.channelName || (
                          <span className="text-zinc-600 italic">No channel name set</span>
                        )}
                      </span>
                      <button
                        onClick={() => startEdit("channel")}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-white/10 transition"
                        title="Edit channel name"
                      >
                        <EditIcon className="size-3 text-zinc-500" />
                      </button>
                    </>
                  )}
                </div>

                {/* Plan badge */}
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${currentPlan.bgColor} ${currentPlan.border}`}>
                  <PlanIcon className={`size-4 ${currentPlan.color}`} />
                  <span className={currentPlan.color}>{currentPlan.name}</span>
                </div>
              </div>
            </div>

            {/* Credits section */}
            {!hasNoPlan && (
              <div className="mt-8 grid sm:grid-cols-3 gap-4">
                {/* Credits remaining */}
                <div className="sm:col-span-2 p-5 bg-black/20 rounded-2xl border border-white/8 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400 flex items-center gap-1.5">
                      <ImageIcon className="size-4" /> Credits Remaining
                    </span>
                    <span className="text-xl font-bold text-brand-400">
                      {user.credits}
                      <span className="text-sm font-normal text-zinc-500"> / {user.totalCredits}</span>
                    </span>
                  </div>
                  <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-brand-600 to-brand-400"
                      style={{ width: `${creditsPercentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    {user.credits > 0
                      ? `~${Math.floor(user.credits / 5)} thumbnails remaining (5 credits each)`
                      : "No credits left — buy more to continue"}
                  </p>
                </div>

                {/* Quick stat */}
                <div className="p-5 bg-black/20 rounded-2xl border border-white/8 flex flex-col justify-center gap-1">
                  <span className="text-xs text-zinc-500">Total Purchased</span>
                  <span className="text-3xl font-bold text-white">{user.totalCredits}</span>
                  <span className="text-xs text-zinc-500">lifetime credits</span>
                </div>
              </div>
            )}
          </div>

          {/* ── BUY CREDITS ── */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-brand-900/40 rounded-xl border border-brand-800">
                <ShoppingBagIcon className="size-5 text-brand-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {hasNoPlan ? "Choose a Plan" : "Buy More Credits"}
                </h2>
                <p className="text-sm text-zinc-500">
                  {hasNoPlan
                    ? "Select a plan to start generating AI thumbnails"
                    : "One-time purchase. Credits never expire."}
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {PLAN_CARDS.map((plan) => {
                const PIcon = plan.icon;
                return (
                  <div
                    key={plan.id}
                    className={`relative bg-white/5 border ${plan.border} rounded-2xl p-6 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5`}
                  >
                    {plan.badge && (
                      <span className={`absolute top-4 right-4 text-[10px] font-bold px-2.5 py-1 rounded-full ${plan.badgeStyle}`}>
                        {plan.badge}
                      </span>
                    )}

                    <div className={`inline-flex p-2.5 rounded-xl ${plan.iconBg} mb-4`}>
                      <PIcon className={`size-5 ${plan.iconColor}`} />
                    </div>

                    <h3 className="text-lg font-bold text-white mb-0.5">{plan.name}</h3>
                    <p className="text-xs text-zinc-500 mb-4">{plan.tagline}</p>

                    <p className="text-3xl font-bold text-white mb-5">
                      {plan.price}
                      <span className="text-sm font-normal text-zinc-500 ml-1">one-time</span>
                    </p>

                    <ul className="space-y-2 mb-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className={`flex items-center gap-2 text-sm ${plan.featureFlags[i] ? "text-zinc-300" : "text-zinc-600"}`}>
                          <span className={`size-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${plan.featureFlags[i] ? "bg-brand-500/20 text-brand-400" : "bg-white/5 text-zinc-600"}`}>
                            {plan.featureFlags[i] ? "✓" : "✗"}
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handlePurchase(plan.id)}
                      disabled={purchaseLoading !== null}
                      className={`w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${plan.btn} text-white`}
                    >
                      {purchaseLoading === plan.id ? (
                        <>
                          <Loader2Icon className="size-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        `Get ${plan.name}`
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Profile;
