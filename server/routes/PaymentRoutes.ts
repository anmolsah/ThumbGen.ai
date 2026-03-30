import express from "express";
import {
  createOrder,
  verifyPayment,
  paymentWebhook,
  getPaymentHistory,
} from "../controllers/PaymentController.js";
import protect from "../middlewares/auth.js";

const PaymentRouter = express.Router();

// Protected routes
PaymentRouter.post("/create-order", protect, createOrder);
PaymentRouter.post("/verify", verifyPayment);
PaymentRouter.get("/history", protect, getPaymentHistory);

// Webhook (no auth - called by Dodo Payments)
PaymentRouter.post("/webhook", paymentWebhook);

export default PaymentRouter;

