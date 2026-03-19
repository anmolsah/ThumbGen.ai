"use client";
import SectionTitle from "../components/SectionTitle";

import { motion } from "motion/react";
import { featuresData } from "../data/features";
import type { IFeature } from "../types";

export default function FeaturesSection() {
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
        <div className="mt-16 overflow-visible relative min-h-[200px] md:min-h-[300px] flex items-center">
          <div className="absolute left-0 top-0 bottom-0 w-12 md:w-32 bg-gradient-to-r from-black to-transparent z-10"></div>
          <div className="absolute right-0 top-0 bottom-0 w-12 md:w-32 bg-gradient-to-l from-black to-transparent z-10"></div>
          
          <p className="absolute top-0 left-1/2 -translate-x-1/2 text-xs md:text-sm uppercase tracking-[0.4em] text-brand-500 font-black mb-10 text-center w-full">
            Trusted by studios
          </p>
          
          <div className="flex w-full overflow-hidden py-10 md:py-20">
            <motion.div 
              className="flex gap-8 md:gap-20 whitespace-nowrap items-center"
              animate={{ x: [0, -1200] }}
              transition={{ 
                duration: 30, 
                repeat: Infinity, 
                ease: "linear" 
              }}
            >
              {[
                "Studio71", "Fullscreen", "Maker Studios", "Machinima", "BroadbandTV", 
                "Vevo", "BuzzFeed", "T-Series", "MrBeast", "PewDiePie",
                "Studio71", "Fullscreen", "Maker Studios", "Machinima", "BroadbandTV"
              ].map((studio, i) => (
                <motion.span 
                  key={i} 
                  className="text-2xl md:text-6xl font-black text-slate-800/80 hover:text-brand-500 transition-colors duration-500 cursor-default"
                  animate={{ 
                    y: [0, i % 2 === 0 ? -10 : 10, 0],
                    rotate: [0, i % 2 === 0 ? 1 : -1, 0]
                  }}
                  transition={{
                    duration: 4 + (i % 3),
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  {studio}
                </motion.span>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
