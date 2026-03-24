import { Cashfree, CFEnvironment } from "cashfree-pg";

// Initialize Cashfree (v5+ uses constructor pattern)
const isProduction = process.env.CASHFREE_ENVIRONMENT === "PRODUCTION" || process.env.NODE_ENV === "production";

const cashfree = new Cashfree(
  isProduction ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
  process.env.CASHFREE_APP_ID as string,
  process.env.CASHFREE_SECRET_KEY as string
);

export const getCashfreeEnvironmentString = () => isProduction ? "production" : "sandbox";

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

