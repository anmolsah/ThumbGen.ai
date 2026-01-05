import type { IPricing } from "../types";

export const pricingData: IPricing[] = [
  {
    name: "Free Plan",
    price: 0,
    period: "trial",
    features: ["25 Credits", "5 Thumbnails", "Ultra 4K Quality", "Watermarked"],
    mostPopular: false,
  },
  {
    name: "Creator Plan",
    price: 299,
    period: "month",
    features: ["200 Credits", "40 Thumbnails", "Ultra 4K Quality", "No Watermark"],
    mostPopular: true,
  },
  {
    name: "Pro Plan",
    price: 799,
    period: "month",
    features: [
      "800 Credits",
      "160 Thumbnails",
      "Ultra 4K Quality",
      "No Watermark",
    ],
    mostPopular: false,
  },
];
