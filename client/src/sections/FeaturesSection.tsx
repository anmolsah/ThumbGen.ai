"use client";
import SectionTitle from "../components/SectionTitle";
import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { featuresData } from "../data/features";
import type { IFeature } from "../types";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function FeaturesSection() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  const handleGenerateClick = () => {
    if (isLoggedIn) {
      navigate("/generate");
    } else {
      navigate("/login");
    }
  };

  return (
    <div id="features" className="px-4 md:px-16 lg:px-24 xl:px-32">
      <SectionTitle
        text1="Features"
        text2="Why use our generator?"
        text3="Create stunning thumbnails that get clicks, without the hassle."
      />
      <div className="flex flex-wrap items-center justify-center gap-6 md:gap-4 mt-16 px-6">
        {featuresData.map((feature: IFeature, index: number) => (
          <motion.div
            key={index}
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
            <div className="p-6 rounded-xl space-y-4 border border-slate-800 bg-slate-950 max-w-80 w-full">
              <img src={feature.icon} alt={feature.title} />
              <h3 className="text-base font-medium text-white">
                {feature.title}
              </h3>
              <p className="text-slate-400 line-clamp-2 pb-4">
                {feature.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-40 relative mx-auto max-w-5xl">
        <div className="absolute -z-50 size-100 -top-10 -left-20 aspect-square rounded-full bg-brand-500/40 blur-3xl"></div>
        <motion.p
          className="text-slate-300 text-lg text-left max-w-3xl"
          initial={{ y: 150, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 320, damping: 70, mass: 1 }}
        >
          Our AI understands what makes a video go viral and designs thumbnails
          accordingly.
        </motion.p>
        <div className="mt-16 overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10"></div>
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10"></div>
          
          <p className="text-center text-xs uppercase tracking-[0.3em] text-slate-500 font-bold mb-10">
            Trusted by creators from
          </p>
          
          <motion.div 
            className="flex gap-12 whitespace-nowrap"
            animate={{ x: [0, -1000] }}
            transition={{ 
              duration: 20, 
              repeat: Infinity, 
              ease: "linear" 
            }}
          >
            {[
              "Studio71", "Fullscreen", "Maker Studios", "Machinima", "BroadbandTV", 
              "Vevo", "BuzzFeed", "T-Series", "MrBeast", "PewDiePie",
              "Studio71", "Fullscreen", "Maker Studios", "Machinima", "BroadbandTV"
            ].map((studio, i) => (
              <span key={i} className="text-2xl md:text-3xl font-black text-slate-700 hover:text-brand-500 transition duration-300">
                {studio}
              </span>
            ))}
          </motion.div>
          
          <div className="mt-24 flex flex-col items-center text-center">
            <h3 className="text-2xl md:text-3xl text-white font-semibold mb-4">
              Boost your views with AI-optimized designs
            </h3>
            <p className="text-slate-400 max-w-xl mb-8">
              Stop guessing and start ranking. Our AI creates designs proven to capture attention and drive clicks.
            </p>
            <button
              onClick={handleGenerateClick}
              className="px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-full font-bold transition flex items-center gap-2 shadow-lg shadow-brand-500/20"
            >
              Start generating for free
              <ArrowUpRight className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
