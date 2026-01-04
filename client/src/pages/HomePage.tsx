import HeroSection from "../sections/HeroSection";
import FeaturesSection from "../sections/FeaturesSection";
import TestimonialSection from "../sections/TestimonialSection";
import PricingSection from "../sections/PricingSection";
import ShowcaseSection from "../sections/ShowcaseSection";
import CTASection from "../sections/CTASection";
import SEO from "../components/SEO";

export default function HomePage() {
  return (
    <>
      <SEO
        title="AI YouTube Thumbnail Generator | Create Stunning Thumbnails"
        description="Generate high-converting YouTube thumbnails with AI. No design skills needed. Create professional, click-worthy thumbnails in seconds. Free trial available."
        url="https://thumbgen.online"
      />
      <HeroSection />
      <FeaturesSection />
      <TestimonialSection />
      <PricingSection />
      <ShowcaseSection />
      <CTASection />
    </>
  );
}
