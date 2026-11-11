"use client";
import SectionTitle from "../components/SectionTitle";
import Marquee from "react-fast-marquee";

import thumb1 from "../assets/thumb_1.jpg";
import thumb2 from "../assets/thumb_2.jpg";
import thumb3 from "../assets/thumb_3.jpg";
import thumb4 from "../assets/thumb_4.jpg";
import thumb12 from "../assets/thumb12.jpg";
import thumb5 from "../assets/thumb_5.jpg";
import thumb6 from "../assets/thumb_6.jpg";
import thumb7 from "../assets/thumb_7.jpg";
import thumb8 from "../assets/thumb_8.png";
import thumb9 from "../assets/thumb_9.png";
import thumb10 from "../assets/thumb_10.png";
import thumb11 from "../assets/thumb_11.png";
import thumb_13 from "../assets/thumb_13.png";
import thumb_14 from "../assets/thumb_14.jpg";
import thumb_15 from "../assets/thumb_15.webp";
import thumb_16 from "../assets/thumb_16.jpg";
import thumb_17 from "../assets/thumb_17.jpeg";

interface ShowcaseThumbnail {
  _id: string;
  title: string;
  image_url: string;
  style: string;
}

const thumbnails: ShowcaseThumbnail[] = [
  { _id: "1", title: "10 Tips for Better Sleep", image_url: thumb_17, style: "Bold & Graphic" },
  { _id: "2", title: "Top Smartwatch Under 1499", image_url: thumb1, style: "Bold & Graphic" },
  { _id: "3", title: "Ultimate Gaming Setup", image_url: thumb2, style: "Tech/Futuristic" },
  { _id: "4", title: "Morning Routine for Focus", image_url: thumb3, style: "Minimalist" },
  { _id: "5", title: "Travel Documentary: Japan", image_url: thumb4, style: "Photorealistic" },
  { _id: "6", title: "Scaling to 100K Revenue", image_url: thumb5, style: "Bold & Graphic" },
  { _id: "7", title: "Culinary Masterclass", image_url: thumb6, style: "Illustrated" },
  { _id: "8", title: "Hardware Review", image_url: thumb7, style: "Tech/Futuristic" },
  { _id: "9", title: "Deep Work Systems", image_url: thumb8, style: "Bold & Graphic" },
  { _id: "10", title: "Strength Training Guide", image_url: thumb9, style: "Photorealistic" },
  { _id: "11", title: "Audio Production Workflow", image_url: thumb10, style: "Minimalist" },
  { _id: "12", title: "Founder Postmortem", image_url: thumb11, style: "Illustrated" },
  { _id: "13", title: "India's Highest Jump", image_url: thumb12, style: "Photorealistic" },
  { _id: "14", title: "Expedition Documentary", image_url: thumb_13, style: "Photorealistic" },
  { _id: "15", title: "Street Food Tour", image_url: thumb_14, style: "Bold & Graphic" },
  { _id: "16", title: "AI Engineering Breakdown", image_url: thumb_15, style: "Tech/Futuristic" },
  { _id: "17", title: "Cinema Camera Comparison", image_url: thumb_16, style: "Photorealistic" },
];

export default function ShowcaseSection() {
  return (
    <section className="py-24 border-b border-white/[0.08] bg-[#090a0c]">
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <SectionTitle
          text1="Gallery"
          text2="Recent Studio Outputs"
          text3="Unretouched 16:9 outputs generated across Bold & Graphic, Photorealistic, Minimalist, and Tech/Futuristic styles."
        />
      </div>

      <div className="space-y-4">
        <Marquee
          speed={32}
          gradient={true}
          gradientColor="#090a0c"
          gradientWidth={80}
          pauseOnHover={true}
        >
          {thumbnails.slice(0, 9).map((thumb, index) => (
            <div key={`row1-${thumb._id}-${index}`} className="mx-2.5 group">
              <div className="relative w-72 sm:w-80 aspect-video rounded-xl overflow-hidden border border-white/[0.08] bg-[#111317]">
                <img
                  src={thumb.image_url}
                  alt={thumb.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/Thumbgen.png";
                  }}
                />
              </div>
            </div>
          ))}
        </Marquee>

        <Marquee
          speed={32}
          gradient={true}
          gradientColor="#090a0c"
          gradientWidth={80}
          pauseOnHover={true}
          direction="right"
        >
          {thumbnails.slice(8).map((thumb, index) => (
            <div key={`row2-${thumb._id}-${index}`} className="mx-2.5 group">
              <div className="relative w-72 sm:w-80 aspect-video rounded-xl overflow-hidden border border-white/[0.08] bg-[#111317]">
                <img
                  src={thumb.image_url}
                  alt={thumb.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/Thumbgen.png";
                  }}
                />
              </div>
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
