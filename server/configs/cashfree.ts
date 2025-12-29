import { Cashfree } from "cashfree-pg";

// Initialize Cashfree (v5+ uses constructor pattern)
const cashfree = new Cashfree(
  process.env.NODE_ENV === "production"
    ? Cashfree.PRODUCTION
    : Cashfree.SANDBOX,
  process.env.CASHFREE_APP_ID as string,
  process.env.CASHFREE_SECRET_KEY as string
);

export { cashfree };

// Plan configurations
export const PLANS = {
  creator: {
    name: "Creator Plan",
    price: 299,
    credits: 200,
  },
  pro: {
    name: "Pro Plan",
    price: 799,
    credits: 800,
  },
};
