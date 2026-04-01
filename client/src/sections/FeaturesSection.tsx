"use client";
import SectionTitle from "../components/SectionTitle";
import { motion } from "motion/react";
import { featuresData } from "../data/features";
import type { IFeature } from "../types";

export default function FeaturesSection() {
  return (
    <div id="features" className="px-4 md:px-16 lg:px-24 xl:px-32 relative z-10">
      
      <style>{`
        /* Adapted from Uiverse.io CSS into dark-glass Theme */
        .feature-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
        }

        .feature-card {
          position: relative;
          display: flex;
          justify-content: center;
          cursor: pointer;
          width: 22em;
          max-width: 100%;
          padding: 2.5em 0;
          background: rgba(9, 9, 11, 0.8); /* zinc-950/80 */
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          border-radius: 12px;
          box-shadow: 0 0 15px 0 rgba(0, 0, 0, 0.5);
          transition: all 0.35s ease;
          overflow: hidden;
        }

        .feature-card::before, .feature-card::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          background: #3d8fca; /* brand-500 */
          height: 3px;
        }

        .feature-card::before {
          width: 0;
          opacity: 0;
          transition: opacity 0s ease, width 0s ease;
          transition-delay: 0.5s;
        }

        .feature-card::after {
          width: 100%;
          background: rgba(255,255,255,0.1); /* Subtle inactive top border */
          transition: width 0.5s ease;
        }

        .feature-card .content {
          width: 18em;
          max-width: 85%;
          display: flex;
          flex-direction: column;
        }

        .feature-card .logo {
          margin: 0 0 1em;
          width: max-content;
          color: #5ba3d6; /* brand-400 */
          font-weight: 700;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          border: 1px solid rgba(61,143,202,0.3);
          padding: 4px 12px;
          border-radius: 20px;
          transition: all 0.35s ease;
        }

        .feature-card .h6 {
          color: #fff;
          font-weight: 600;
          font-size: 1.25rem;
          margin: 0;
          letter-spacing: 1px;
        }

        .feature-card .hover_content {
          overflow: hidden;
          max-height: 0;
          transform: translateY(1em);
          transition: all 0.55s ease;
          opacity: 0;
        }

        .feature-card .hover_content p {
          margin: 1.2em 0 0;
          color: #a1a1aa; /* zinc-400 */
          line-height: 1.5em;
          font-size: 0.9rem;
        }

        /* Let touch devices also trigger card hover styles by combining focus/active */
        .feature-card:hover, .feature-card:focus-within {
          transform: translateY(-5px) scale(1.02);
          box-shadow: 0 20px 40px -5px rgba(61,143,202,0.15), 0 0 20px rgba(61,143,202,0.1);
          border-color: rgba(61,143,202,0.3);
        }

        .feature-card:hover::before, .feature-card:focus-within::before {
          width: 100%;
          opacity: 1;
          transition: opacity 0.5s ease, width 0.5s ease;
          transition-delay: 0s;
        }

        .feature-card:hover::after, .feature-card:focus-within::after {
          width: 0;
          opacity: 0;
          transition: width 0s ease;
        }

        .feature-card:hover .logo, .feature-card:focus-within .logo {
          margin-bottom: 0.5em;
          background: rgba(61,143,202,0.1);
        }

        .feature-card:hover .hover_content, .feature-card:focus-within .hover_content {
          max-height: 10em;
          transform: none;
          opacity: 1;
        }
      `}</style>

      <SectionTitle
        text1="Features"
        text2="Why use our generator?"
        text3="Create stunning thumbnails that get clicks, without the hassle."
      />
      
      <div className="flex flex-wrap items-center justify-center gap-6 mt-16 px-2">
        {featuresData.map((feature: IFeature, index: number) => (
          <motion.div
            key={index}
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{
              delay: index * 0.15,
              type: "spring",
              stiffness: 100,
              damping: 20
            }}
            className="feature-container"
            style={{ width: "auto" }}
          >
            <div tabIndex={0} className="feature-card group outline-none">
              <div className="content">
                <p className="logo">{feature.logoLabel}</p>
                <div className="h6">{feature.title}</div>
                <div className="hover_content">
                  <p>{feature.description}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-32 relative mx-auto max-w-5xl">
        <div className="overflow-visible relative min-h-[150px] md:min-h-[200px] flex items-center">
          <div className="absolute left-0 top-0 bottom-0 w-12 md:w-32 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
          <div className="absolute right-0 top-0 bottom-0 w-12 md:w-32 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>
          
          <p className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] md:text-sm uppercase tracking-[0.4em] text-brand-500 font-black mb-10 text-center w-full pointer-events-none">
            Trusted by creators & studios
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
                  tabIndex={0}
                  className="text-xl md:text-5xl font-black text-slate-800/60 hover:text-brand-500 focus:text-brand-500 active:text-brand-500 transition-colors duration-500 cursor-default outline-none"
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
