import type { IPricing } from "../types";

export const pricingData: IPricing[] = [
  {
    name: "Starter Plan",
    price: 9,
    period: "one-time",
    features: ["25 Credits", "5 Thumbnails", "Ultra 4K Quality", "Watermarked"],
    mostPopular: false,
  },
  {
    name: "Creator Plan",
    price: 29,
    period: "one-time",
    features: [
      "200 Credits",
      "40 Thumbnails",
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
      "800 Credits",
      "160 Thumbnails",
      "Ultra 4K Quality",
      "No Watermark",
      "Image Referencing",
    ],
    mostPopular: false,
  },
];
