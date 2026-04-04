import SectionTitle from "../components/SectionTitle";
import TestimonialCard from "../components/TestimonialCard";
import { testimonialsData } from "../data/testimonial";
import type { ITestimonial } from "../types";
import Marquee from "react-fast-marquee";

export default function TestimonialSection() {
    return (
        <div id="testimonials" className="px-4 md:px-16 lg:px-24 xl:px-32">
            <SectionTitle text1="Testimonials" text2="Loved by creators" text3="See how our AI thumbnails are helping channels explode their views." />
            
            <div className="flex items-center justify-center mt-2 mb-8">
                <div className="flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 px-4 py-2 rounded-full backdrop-blur-sm">
                    <div className="flex -space-x-2">
                        {[
                           "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60",
                           "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=60",
                           "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=60",
                           "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=60"
                        ].map((src, i) => (
                           <img key={i} src={src} className="w-6 h-6 rounded-full border border-black" alt="user avatar" />
                        ))}
                    </div>
                    <span className="text-sm font-medium text-brand-300">Currently used by <span className="text-white font-bold">50+ creators</span> worldwide</span>
                </div>
            </div>

            <Marquee className="max-w-5xl mx-auto mt-11" gradient={true} speed={25} gradientColor="#000">
                <div className="flex items-center justify-center py-5 overflow-hidden">
                    {[...testimonialsData, ...testimonialsData].map((testimonial: ITestimonial, index: number) => (
                        <TestimonialCard key={index} index={index} testimonial={testimonial} />
                    ))}
                </div>
            </Marquee>
            <Marquee className="max-w-5xl mx-auto" gradient={true} speed={25} direction="right" gradientColor="#000">
                <div className="flex items-center justify-center py-5 overflow-hidden">
                    {[...testimonialsData, ...testimonialsData].map((testimonial: ITestimonial, index: number) => (
                        <TestimonialCard key={index} index={index} testimonial={testimonial} />
                    ))}
                </div>
            </Marquee>

        </div>
    );
}