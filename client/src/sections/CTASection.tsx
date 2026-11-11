"use client";
import { ArrowRightIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function CTASection() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  return (
    <section className="py-24 bg-[#090a0c]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="rounded-2xl border border-white/[0.1] bg-[#111317] p-8 sm:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-2 max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-zinc-100">
              Ready to ship your next thumbnail in 2K or true 4K?
            </h2>
            <p className="text-sm sm:text-base text-zinc-400">
              Start with a $6 Starter pack (25 credits) or unlock 4K and reference photo conditioning on Creator and Pro.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate(isLoggedIn ? "/generate" : "/login")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-sm"
            >
              <span>Open Studio</span>
              <ArrowRightIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/market-comparison")}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#171a20] hover:bg-white/[0.08] text-zinc-200 border border-white/[0.1] font-medium text-sm"
            >
              <span>Compare Alternatives</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
