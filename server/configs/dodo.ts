import DodoPayments from "dodopayments";

const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.DODO_ENV === "live_mode";

const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY as string,
  environment: isProduction ? "live_mode" : "test_mode",
});

export { dodo };

// Plan configurations (USD)
export const PLANS = {
  starter: {
    name: "Starter Plan",
    price: 9, // USD
    credits: 25,
    productId: process.env.DODO_PRODUCT_STARTER || "prd_STARTER_PLACEHOLDER",
  },
  creator: {
    name: "Creator Plan",
    price: 29, // USD
    credits: 200,
    productId: process.env.DODO_PRODUCT_CREATOR || "prd_CREATOR_PLACEHOLDER",
  },
  pro: {
    name: "Pro Plan",
    price: 59, // USD
    credits: 800,
    productId: process.env.DODO_PRODUCT_PRO || "prd_PRO_PLACEHOLDER",
  },
};
