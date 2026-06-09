import type { IPricing } from "../types";

export const pricingData: IPricing[] = [
  {
    name: "Starter Plan",
    price: 6,
    period: "one-time",
    features: ["25 Credits", "Up to 5 thumbnails", "Ultra 2K Quality", "Watermarked"],
    mostPopular: false,
  },
  {
    name: "Creator Plan",
    price: 29,
    period: "one-time",
    features: [
      "200 Credits",
      "Up to 40 thumbnails",
      "Ultra 4K Quality",
      "No Watermark",
      "Image Referencing",
    ],
    mostPopular: true,
  },
  {
    name: "Pro Plan",
    price: 59,
    period: "one-time",
    features: [
      "400 Credits",
      "Up to 80 thumbnails",
      "Ultra 4K Quality",
      "No Watermark",
      "Image Referencing",
    ],
    mostPopular: false,
  },
];
