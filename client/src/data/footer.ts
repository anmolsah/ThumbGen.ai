import type { IFooter } from "../types";

export const footerData: IFooter[] = [
  {
    title: "Product",
    links: [
      { name: "Home", href: "/" },
      { name: "Pricing", href: "/#pricing" },
      { name: "Compare", href: "/market-comparison" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Privacy Policy", href: "/privacy" },
      { name: "Terms of Service", href: "/terms" },
    ],
  },
];
