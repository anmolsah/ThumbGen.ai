import { Cashfree, CFEnvironment } from "cashfree-pg";

// Initialize Cashfree (v5+ uses constructor pattern)
const cashfree = new Cashfree(
  process.env.NODE_ENV === "production"
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX,
  process.env.CASHFREE_APP_ID as string,
  process.env.CASHFREE_SECRET_KEY as string
);

export { cashfree };

// Plan configurations
export const PLANS = {
  starter: {
    name: "Starter Plan",
    price: 59,
    credits: 25,
  },
  creator: {
    name: "Creator Plan",
    price: 699,
    credits: 200,
  },
  pro: {
    name: "Pro Plan",
    price: 2999,
    credits: 800,
  },
};

