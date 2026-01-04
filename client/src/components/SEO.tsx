import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
}

const defaultTitle = "ThumbGen - AI YouTube Thumbnail Generator";
const defaultDescription =
  "Generate high-converting YouTube thumbnails with AI. No design skills needed. Create professional, click-worthy thumbnails in seconds.";

export default function SEO({ title, description }: SEOProps) {
  useEffect(() => {
    // Update title
    document.title = title ? `${title} | ThumbGen` : defaultTitle;

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        description || defaultDescription
      );
    }

    // Update OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute(
        "content",
        title ? `${title} | ThumbGen` : defaultTitle
      );
    }

    const ogDescription = document.querySelector(
      'meta[property="og:description"]'
    );
    if (ogDescription) {
      ogDescription.setAttribute("content", description || defaultDescription);
    }

    // Update Twitter tags
    const twitterTitle = document.querySelector(
      'meta[property="twitter:title"]'
    );
    if (twitterTitle) {
      twitterTitle.setAttribute(
        "content",
        title ? `${title} | ThumbGen` : defaultTitle
      );
    }

    const twitterDescription = document.querySelector(
      'meta[property="twitter:description"]'
    );
    if (twitterDescription) {
      twitterDescription.setAttribute(
        "content",
        description || defaultDescription
      );
    }
  }, [title, description]);

  return null;
}
