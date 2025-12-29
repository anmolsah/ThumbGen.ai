import express from "express";
import {
  createOrder,
  verifyPayment,
  paymentWebhook,
  getPaymentHistory,
  activateFreePlan,
} from "../controllers/PaymentController.js";
import protect from "../middlewares/auth.js";

const PaymentRouter = express.Router();

// Protected routes
PaymentRouter.post("/create-order", protect, createOrder);
PaymentRouter.post("/verify", protect, verifyPayment);
PaymentRouter.post("/activate-free", protect, activateFreePlan);
PaymentRouter.get("/history", protect, getPaymentHistory);

// Webhook (no auth - called by Cashfree)
PaymentRouter.post("/webhook", paymentWebhook);

export default PaymentRouter;
