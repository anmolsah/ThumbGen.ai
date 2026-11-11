import DodoPayments from "dodopayments";
import { loadRegistryConfig } from "./registryValidator.js";

const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.DODO_ENV === "live_mode";

const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY as string,
  environment: isProduction ? "live_mode" : "test_mode",
});

export { dodo };

const registryPlans = loadRegistryConfig().plans;

// Plan configurations sourced from config/registry.json (PLAN.md Section 2)
export const PLANS = {
  starter: {
    name: registryPlans.starter.name,
    price: registryPlans.starter.price_usd, // $6 USD
    credits: registryPlans.starter.credits, // 25 credits
    productId: process.env.DODO_PRODUCT_STARTER || "prd_STARTER_PLACEHOLDER",
  },
  creator: {
    name: registryPlans.creator.name,
    price: registryPlans.creator.price_usd, // $29 USD
    credits: registryPlans.creator.credits, // 200 credits
    productId: process.env.DODO_PRODUCT_CREATOR || "prd_CREATOR_PLACEHOLDER",
  },
  pro: {
    name: registryPlans.pro.name,
    price: registryPlans.pro.price_usd, // $59 USD
    credits: registryPlans.pro.credits, // 400 credits
    productId: process.env.DODO_PRODUCT_PRO || "prd_PRO_PLACEHOLDER",
  },
};
