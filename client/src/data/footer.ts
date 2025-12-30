import type { IFooter } from "../types";

export const footerData: IFooter[] = [
  {
    title: "Product",
    links: [
      { name: "Home", href: "/" },
      { name: "Generate", href: "/generate" },
      { name: "Pricing", href: "/profile" },
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
