"use client";
import { ChevronRightIcon, SparklesIcon } from "lucide-react";
import TiltedImage from "../components/TiltImage";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function HeroSection() {
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
    <div className="relative flex flex-col items-center justify-center px-4 md:px-16 lg:px-24 xl:px-32 overflow-hidden">
      {/* Animated background gradients */}
      <div className="absolute top-20 -z-10 left-1/4 size-96 bg-[#3D8FCA] blur-[350px] animate-pulse"></div>
      <div className="absolute top-40 -z-10 right-1/4 size-72 bg-[#143258] blur-[300px] animate-pulse delay-1000"></div>
      <div className="absolute top-60 -z-10 left-1/2 size-64 bg-[#28659C] blur-[280px] animate-pulse delay-500"></div>

      {/* Floating particles effect */}
      <div className="absolute inset-0 -z-5 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute size-2 bg-[#3D8FCA]/30 rounded-full"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.8, 0.3],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
          />
        ))}
      </div>


      {/* Main Heading */}
      <motion.h1
        className="text-5xl/[1.15] md:text-6xl/[1.15] lg:text-7xl/[1.1] font-bold max-w-4xl text-center mt-28 md:mt-36 lg:mt-40"
        initial={{ y: 50, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 240, damping: 70, mass: 1 }}
      >
        <span className="bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent">
          AI Thumbnail Generator
        </span>
        <br />
        <span className="bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent">
          for your{" "}
        </span>
        <motion.span
          className="relative inline-block"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <span className="relative z-10 bg-gradient-to-r from-[#3D8FCA] via-[#28659C] to-[#3D8FCA] bg-[length:200%_100%] animate-[gradient_3s_ease_infinite] bg-clip-text text-transparent">
            Videos.
          </span>
          <motion.span
            className="absolute -inset-2 bg-gradient-to-r from-[#3D8FCA]/20 to-[#28659C]/20 rounded-2xl blur-xl -z-10"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.span>
      </motion.h1>

      {/* Subheading */}
      <motion.p
        className="text-lg text-center text-slate-300 max-w-xl mt-6 leading-relaxed"
        initial={{ y: 50, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{
          delay: 0.2,
          type: "spring",
          stiffness: 320,
          damping: 70,
          mass: 1,
        }}
      >
        Stop wasting hours on design. Get{" "}
        <span className="text-[#3D8FCA] font-medium">
          high-converting thumbnails
        </span>{" "}
        in seconds with our advanced AI.
      </motion.p>

      {/* CTA Buttons */}
      <motion.div
        className="flex flex-col sm:flex-row items-center gap-4 mt-10"
        initial={{ y: 50, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 320, damping: 70, mass: 1 }}
      >
        <motion.button
          onClick={handleGenerateClick}
          className="relative group bg-gradient-to-r from-[#3D8FCA] to-[#28659C] text-white font-semibold rounded-full px-8 h-12 shadow-lg shadow-[#3D8FCA]/30 hover:shadow-xl hover:shadow-[#3D8FCA]/40 transition-all duration-300"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="relative z-10 flex items-center gap-2">
            <SparklesIcon size={18} />
            Generate Now
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-[#28659C] to-[#143258] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </motion.button>

        <motion.button
          onClick={() => navigate("/how-it-works")}
          className="group flex items-center gap-2 border-2 border-[#28659C]/50 hover:border-[#3D8FCA] bg-[#143258]/30 hover:bg-[#143258]/50 backdrop-blur-sm transition-all duration-300 rounded-full px-7 h-12 text-white/90 hover:text-white"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          <span>See how it works</span>
          <ChevronRightIcon
            size={18}
            className="group-hover:translate-x-1 transition-transform duration-300"
          />
        </motion.button>
      </motion.div>


      <TiltedImage />
    </div>
  );
}
