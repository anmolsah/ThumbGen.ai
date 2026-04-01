import { useState, useEffect, useRef } from "react";
import { platforms } from "../assets/assets";
import { PlatformIcons } from "../components/PlatformSelector";
import { motion, useScroll, useTransform } from "motion/react";

const PlatformSection = () => {
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(hover: none) and (pointer: coarse)").matches || window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Use a smaller radius on mobile so icons don't overflow horizontally
  const explosionRadius = isMobile ? 140 : 250; 

  // Tie scroll progress to rotation
  const { scrollYProgress } = useScroll({ 
    target: containerRef,
    offset: ["start end", "end start"] 
  });
  
  // Rotating the entire orbit container clockwise as user scrolls down
  // 1 progress = 1 full rotation (360 degrees) or more. Let's make it subtly aggressive.
  const orbitRotation = useTransform(scrollYProgress, [0, 1], [-180, 180]);
  
  // Counter-rotating the individual icons so they always stay upright
  const iconCounterRotation = useTransform(scrollYProgress, [0, 1], [180, -180]);

  return (
    <section ref={containerRef} className="pt-24 md:pt-40 pb-12 bg-black relative overflow-hidden border-y border-white/5">
       {/* Background Glow */}
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-96 bg-brand-500/20 blur-[150px] rounded-full pointer-events-none" />

       <div className="max-w-7xl mx-auto px-4 relative z-10 text-center mb-8 md:mb-16">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true, margin: "-100px" }}
           transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold font-poppins text-white mb-6">
            Create for Any Platform
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto text-sm md:text-lg">
            Generate pixel-perfect thumbnails optimized for the algorithms of all major social networks, automatically formatted logic.
          </p>
        </motion.div>
       </div>

       {/* Outer Container sets the stage */}
       <motion.div 
         className="relative w-full h-[400px] md:h-[600px] flex items-center justify-center"
         initial="hidden"
         whileInView="visible"
         viewport={{ once: true, margin: "-100px" }}
       >
          {/* Central Core Box - "The Engine" (Static rotation or independent) */}
          <motion.div 
            className="absolute z-20 flex flex-col items-center justify-center p-6 md:p-10 rounded-3xl bg-zinc-950 border border-brand-500/30 shadow-[0_0_80px_rgba(61,143,202,0.4)] backdrop-blur-md"
            variants={{
               hidden: { scale: 0.2, opacity: 0, rotate: -45 },
               visible: { 
                 scale: 1, 
                 opacity: 1, 
                 rotate: 0,
                 transition: { type: "spring", delay: 0.1, duration: 1.5, bounce: 0.4 } 
               }
            }}
          >
             <img src="/logo.png" alt="ThumbGen Logo" className="h-12 md:h-16 w-auto object-contain drop-shadow-[0_0_15px_rgba(61,143,202,0.5)]" />
          </motion.div>

          {/* The Rotating Orbit Layer */}
          <motion.div 
            className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
            style={{ rotate: orbitRotation }}
          >
            {/* Emerging Sub Icons spltting out into orbit */}
            {platforms.map((platform, i) => {
               // Calculate 360 degree circle distribution
               const angle = (i * Math.PI * 2) / platforms.length;
               const x = Math.cos(angle) * explosionRadius;
               const y = Math.sin(angle) * explosionRadius;

               return (
                 <motion.div
                   key={platform.id}
                   className="absolute pointer-events-auto"
                   variants={{
                      hidden: { x: 0, y: 0, scale: 0, opacity: 0 },
                      visible: { 
                         x, y, scale: 1, opacity: 1,
                         transition: { 
                            type: "spring", 
                            stiffness: 80,
                            damping: 10,
                            delay: 0.4 + (i * 0.04) 
                         }
                      }
                   }}
                 >
                   {/* Counter-rotate the inner element so icons stay upright! */}
                   <motion.div style={{ rotate: iconCounterRotation }}>
                     <div className="relative group flex flex-col items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-125 hover:z-50 active:scale-95">
                        <div className="size-14 md:size-20 rounded-full bg-zinc-900 border border-white/10 shadow-xl flex items-center justify-center group-hover:border-brand-500/50 group-hover:bg-zinc-800 transition-colors">
                           <div className="scale-110 md:scale-150 relative z-10 group-hover:text-brand-400 text-zinc-300 transition-colors">
                              {PlatformIcons[platform.id]}
                           </div>
                        </div>
                        {/* Floating Hover tooltip label */}
                        <div className="absolute top-[110%] md:top-[120%] opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap bg-zinc-800 text-white text-[10px] md:text-xs px-3 py-1.5 rounded-lg border border-white/10 shadow-lg font-medium pointer-events-none">
                           {platform.label}
                        </div>
                     </div>
                   </motion.div>
                 </motion.div>
               )
            })}
          </motion.div>
       </motion.div>
    </section>
  );
};

export default PlatformSection;
