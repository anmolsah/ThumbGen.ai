import { platforms } from "../assets/assets";
import { PlatformIcons } from "../components/PlatformSelector";
import { motion } from "motion/react";

const PlatformSection = () => {
  // Deduplicate platforms so we just have unique icons (since some like instagram-story/post use the same icon, we can filter or just map all 10)
  // Let's render all 10 to make it look full and engaging.
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.3, y: 20 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 15
      }
    },
  };

  return (
    <section className="py-24 bg-black relative overflow-hidden border-y border-white/5">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-64 bg-brand-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold font-poppins text-white mb-4">
            Create for Any Platform
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto text-sm md:text-base mb-16">
            Generate pixel-perfect thumbnails optimized for the algorithms of all major social networks.
          </p>
        </motion.div>

        {/* Overlapping Pop Carousel */}
        <motion.div 
          className="flex flex-wrap justify-center items-center -space-x-4 md:-space-x-6 px-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {platforms.map((platform, idx) => (
            <motion.div
              key={`${platform.id}-${idx}`}
              variants={itemVariants}
              whileHover={{ 
                scale: 1.2, 
                zIndex: 30,
                y: -10,
                transition: { type: "spring", stiffness: 400, damping: 10 }
              }}
              whileTap={{ 
                scale: 1.1, 
                zIndex: 30,
                y: -10,
                transition: { type: "spring", stiffness: 400, damping: 10 }
              }}
              className="relative group z-10 cursor-pointer"
            >
              <div 
                className="size-16 md:size-20 rounded-full bg-zinc-900 border border-white/10 shadow-xl flex items-center justify-center backdrop-blur-md transition-colors group-hover:bg-zinc-800"
                style={{ 
                  boxShadow: "0 0 20px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05)" 
                }}
              >
                {/* Scale up the SVG slightly */}
                <div className="scale-125 md:scale-150">
                  {PlatformIcons[platform.id]}
                </div>
              </div>
              
              {/* Tooltip on hover */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black text-white text-[10px] md:text-xs px-2 py-1 rounded border border-white/10 pointer-events-none">
                {platform.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default PlatformSection;
