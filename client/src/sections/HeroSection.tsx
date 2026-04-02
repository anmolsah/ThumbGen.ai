"use client";
import { ChevronRightIcon, SparklesIcon, ZapIcon, CheckCircle2Icon, PlayCircleIcon } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRef } from "react";

// Import all thumbnails natively from assets
import thumb_1 from "../assets/thumb_1.jpg";
import thumb_2 from "../assets/thumb_2.jpg";
import thumb_3 from "../assets/thumb_3.jpg";
import thumb_4 from "../assets/thumb_4.jpg";
import thumb_5 from "../assets/thumb_5.jpg";
import thumb_6 from "../assets/thumb_6.jpg";
import thumb_7 from "../assets/thumb_7.jpg";
import thumb_8 from "../assets/thumb_8.png";
import thumb_9 from "../assets/thumb_9.png";
import thumb_10 from "../assets/thumb_10.png";
import thumb_11 from "../assets/thumb_11.png";
import thumb_12 from "../assets/thumb12.jpg";

const row1 = [thumb_1, thumb_2, thumb_3, thumb_4, thumb_5, thumb_6];
const row2 = [thumb_7, thumb_8, thumb_9, thumb_10, thumb_11, thumb_12];
const row3 = [thumb_6, thumb_5, thumb_2, thumb_1, thumb_4, thumb_3]; // Shuffled

export default function HeroSection() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  
  // Parallax effects
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "80%"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const handleGenerateClick = () => {
    if (isLoggedIn) {
      navigate("/generate");
    } else {
      navigate("/login");
    }
  };

  return (
    <div ref={heroRef} className="relative flex flex-col items-center justify-center px-4 md:px-8 overflow-hidden min-h-screen pt-32 md:pt-40 pb-20">
      
      {/* 3D THUMBNAIL TORNADO WIND CHIME BACKGROUND */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" style={{ perspective: "1500px" }}>
        {/* Glow behind the wall */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[80vh] bg-brand-500/10 blur-[150px] mix-blend-screen rounded-full" />
        
        {/* The 3D Rotating Wall */}
        <div 
          className="absolute top-[-20%] left-[-20%] w-[140vw] h-[140vh] flex flex-col justify-center gap-6 md:gap-10 opacity-30 sm:opacity-40"
          style={{ transform: "rotateX(25deg) rotateY(-20deg) rotateZ(8deg) scale(1.1)", transformOrigin: "center center" }}
        >
          {/* Row 1 */}
          <div className="flex gap-6 md:gap-10 animate-marquee w-[200%]">
            {[...row1, ...row1, ...row1].map((src, i) => (
              <img key={`r1-${i}`} src={src} className="w-64 md:w-96 aspect-video object-cover rounded-2xl shadow-2xl border border-white/5" alt="Thumbnail" />
            ))}
          </div>
          {/* Row 2 Reverse */}
          <div className="flex gap-6 md:gap-10 animate-marquee-reverse w-[200%]">
            {[...row2, ...row2, ...row2].map((src, i) => (
              <img key={`r2-${i}`} src={src} className="w-64 md:w-96 aspect-video object-cover rounded-2xl shadow-2xl border border-white/5" alt="Thumbnail" />
            ))}
          </div>
          {/* Row 3 */}
          <div className="flex gap-6 md:gap-10 animate-marquee w-[200%]">
            {[...row3, ...row3, ...row3].map((src, i) => (
              <img key={`r3-${i}`} src={src} className="w-64 md:w-96 aspect-video object-cover rounded-2xl shadow-2xl border border-white/5" alt="Thumbnail" />
            ))}
          </div>
        </div>
        
        {/* Gradient Overlay to fade bottom and top into black */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/40 to-black pointer-events-none" />
      </div>

      {/* Main Hero Content */}
      <motion.div style={{ y: textY, opacity: textOpacity }} className="relative z-10 flex flex-col items-center w-full max-w-5xl mx-auto">


        <motion.h1 
          className="text-5xl md:text-7xl lg:text-8xl font-black text-center tracking-tight leading-[1.1] md:leading-[1.05]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <span className="text-white drop-shadow-2xl">Create Jaw-Dropping</span>
          <br />
          <span className="relative inline-block mt-2">
            <span className="bg-gradient-to-r from-brand-300 via-brand-500 to-brand-300 bg-[length:200%_auto] animate-[gradient_3s_linear_infinite] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(61,143,202,0.5)]">
              Thumbnails in Seconds.
            </span>
          </span>
        </motion.h1>

        <motion.p 
          className="mt-8 text-lg md:text-2xl text-zinc-300 max-w-3xl text-center leading-relaxed drop-shadow-lg"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          The thumbnails you see floating behind this text? They were generated by<strong> Thumbgen</strong>. Give your videos the incredible click-through rate they deserve.
        </motion.p>

        {/* Action Buttons */}
        <motion.div 
          className="flex flex-col sm:flex-row items-center gap-6 mt-12 mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          <button 
            onClick={handleGenerateClick}
            className="w-full sm:w-auto overflow-hidden relative group bg-white hover:bg-zinc-200 text-black font-extrabold text-xl rounded-2xl px-10 py-5 shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] transition-all duration-300 hover:scale-105"
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              <SparklesIcon size={24} className="text-brand-600" /> Start Generating Free
            </span>
          </button>
          
          <button 
            onClick={() => {
              const videoSection = document.getElementById('demo-video');
              videoSection?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group flex items-center gap-3 border-2 border-white/20 hover:border-brand-500 bg-black/40 hover:bg-black/60 backdrop-blur-md transition-all duration-300 rounded-2xl px-8 py-5 text-lg font-bold text-white hover:shadow-[0_0_20px_rgba(61,143,202,0.3)] hover:scale-105"
          >
            <PlayCircleIcon size={24} className="text-brand-400 group-hover:scale-110 transition-transform" />
            Watch Demo
          </button>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div 
          className="flex flex-wrap justify-center gap-4 md:gap-8 mt-6 text-sm md:text-base font-medium text-zinc-300 drop-shadow-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.5 }}
        >
          <span className="flex items-center gap-2"><CheckCircle2Icon size={18} className="text-brand-400" /> Free 25 Credits</span>
          <span className="flex items-center gap-2"><CheckCircle2Icon size={18} className="text-brand-400" /> No Credit Card Required</span>
          <span className="flex items-center gap-2"><CheckCircle2Icon size={18} className="text-brand-400" /> Commercial Usage</span>
        </motion.div>
      </motion.div>

      {/* DEMO VIDEO SHOWCASE CONTAINER */}
      <motion.div 
        id="demo-video"
        className="relative w-full max-w-6xl mx-auto mt-24 md:mt-40 z-20"
        initial={{ opacity: 0, y: 100 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
      >
        {/* Glow beneath the video */}
        <div className="absolute inset-0 bg-brand-500/30 blur-[100px] rounded-[40px] pointer-events-none" />
        
        {/* The Video Wrapper */}
        <div className="relative rounded-[20px] md:rounded-[40px] p-2 md:p-4 bg-white/5 border border-white/10 backdrop-blur-3xl shadow-2xl">
           <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-400/50 to-transparent" />
           <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-400/20 to-transparent" />
           
           <div className="relative aspect-video rounded-[12px] md:rounded-[28px] overflow-hidden bg-black flex items-center justify-center group cursor-pointer border border-white/10 relative">
             {/* Note: Swap out this placeholder image/iframe later */}
             <img src={thumb_12} className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity duration-500" alt="Video Placeholder" />
             
             {/* Play Button Overlay */}
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <div className="size-20 md:size-28 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/90 group-hover:scale-110 group-hover:bg-brand-500/80 transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                 <PlayCircleIcon size={48} className="md:w-16 md:h-16 ml-2" />
               </div>
             </div>
             
             <div className="absolute bottom-6 left-8 right-8 text-white hidden md:block">
               <h3 className="text-2xl font-bold drop-shadow-lg">See ThumbGen in Action</h3>
               <p className="text-zinc-300 drop-shadow-md">Watch how we generate YouTube thumbnails using Thumbgen.</p>
             </div>
           </div>
        </div>
      </motion.div>

    </div>
  );
}
