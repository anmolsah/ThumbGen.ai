"use client";
import SectionTitle from "../components/SectionTitle";
import { motion } from "motion/react";
import Marquee from "react-fast-marquee";

// Import images from assets
import thumb1 from "../assets/thumb_1.jpg";
import thumb2 from "../assets/thumb_2.jpg";
import thumb3 from "../assets/thumb_3.jpg";
import thumb4 from "../assets/thumb_4.jpg";
import thumb5 from "../assets/thumb_5.jpg";
import thumb6 from "../assets/thumb_6.jpg";
import thumb7 from "../assets/thumb_7.jpg";
import thumb8 from "../assets/1.png";
import thumb9 from "../assets/2.png";
import thumb10 from "../assets/3.jpg";
import thumb11 from "../assets/5.png";

interface ShowcaseThumbnail {
  _id: string;
  title: string;
  image_url: string;
  style: string;
}

// Showcase thumbnails from local assets
const thumbnails: ShowcaseThumbnail[] = [
  {
    _id: "1",
    title: "10 Tips for Better Sleep",
    image_url: thumb1,
    style: "Bold & Graphic",
  },
  {
    _id: "2",
    title: "Ultimate Gaming Setup 2025",
    image_url: thumb2,
    style: "Tech/Futuristic",
  },
  {
    _id: "3",
    title: "Morning Routine for Success",
    image_url: thumb3,
    style: "Minimalist",
  },
  {
    _id: "4",
    title: "Travel Vlog: Japan",
    image_url: thumb4,
    style: "Photorealistic",
  },
  {
    _id: "5",
    title: "How I Made $10K",
    image_url: thumb5,
    style: "Bold & Graphic",
  },
  {
    _id: "6",
    title: "Cooking Masterclass",
    image_url: thumb6,
    style: "Illustrated",
  },
  {
    _id: "7",
    title: "Tech Review 2025",
    image_url: thumb7,
    style: "Tech/Futuristic",
  },
  {
    _id: "8",
    title: "Productivity Hacks",
    image_url: thumb8,
    style: "Bold & Graphic",
  },
  {
    _id: "9",
    title: "Fitness Journey",
    image_url: thumb9,
    style: "Photorealistic",
  },
  {
    _id: "10",
    title: "Music Production Tips",
    image_url: thumb10,
    style: "Minimalist",
  },
  {
    _id: "11",
    title: "Startup Success Story",
    image_url: thumb11,
    style: "Illustrated",
  },
];

export default function ShowcaseSection() {
  return (
    <div className="py-20">
      <SectionTitle
        text1="Showcase"
        text2="Created with ThumbGen.ai"
        text3="See what creators are building with our AI thumbnail generator."
      />

      <motion.div
        className="mt-16"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        {/* First row - left to right */}
        <Marquee
          speed={40}
          gradient={true}
          gradientColor="black"
          gradientWidth={100}
          pauseOnHover={true}
          className="mb-6"
        >
          {thumbnails.map((thumb, index) => (
            <motion.div
              key={`row1-${thumb._id}-${index}`}
              className="mx-3 group"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <div className="relative w-80 aspect-video rounded-xl overflow-hidden border border-white/10 shadow-xl">
                <img
                  src={thumb.image_url}
                  alt={thumb.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/Thumbgen.png";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-sm font-medium text-white line-clamp-1">
                      {thumb.title}
                    </p>
                    <span className="text-xs text-brand-400">
                      {thumb.style}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </Marquee>

        {/* Second row - right to left */}
        <Marquee
          speed={40}
          gradient={true}
          gradientColor="black"
          gradientWidth={100}
          pauseOnHover={true}
          direction="right"
        >
          {[...thumbnails].reverse().map((thumb, index) => (
            <motion.div
              key={`row2-${thumb._id}-${index}`}
              className="mx-3 group"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <div className="relative w-80 aspect-video rounded-xl overflow-hidden border border-white/10 shadow-xl">
                <img
                  src={thumb.image_url}
                  alt={thumb.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/Thumbgen.png";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-sm font-medium text-white line-clamp-1">
                      {thumb.title}
                    </p>
                    <span className="text-xs text-brand-400">
                      {thumb.style}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </Marquee>
      </motion.div>
    </div>
  );
}
