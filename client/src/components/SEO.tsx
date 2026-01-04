import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
}

const defaultSEO = {
  title: "ThumbGen - AI YouTube Thumbnail Generator",
  description:
    "Generate high-converting YouTube thumbnails with AI. No design skills needed. Create professional, click-worthy thumbnails in seconds.",
  keywords:
    "YouTube thumbnail generator, AI thumbnail maker, thumbnail creator, YouTube thumbnail design",
  image: "https://thumbgen.online/Thumbgen.png",
  url: "https://thumbgen.online",
};

export default function SEO({
  title,
  description,
  keywords,
  image,
  url,
}: SEOProps) {
  const seo = {
    title: title ? `${title} | ThumbGen` : defaultSEO.title,
    description: description || defaultSEO.description,
    keywords: keywords || defaultSEO.keywords,
    image: image || defaultSEO.image,
    url: url || defaultSEO.url,
  };

  return (
    <Helmet>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="keywords" content={seo.keywords} />
      <link rel="canonical" href={seo.url} />

      {/* Open Graph */}
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:image" content={seo.image} />
      <meta property="og:url" content={seo.url} />

      {/* Twitter */}
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={seo.image} />
    </Helmet>
  );
}
