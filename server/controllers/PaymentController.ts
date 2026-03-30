import { Request, Response } from "express";
import { dodo, PLANS } from "../configs/dodo.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import crypto from "crypto";
import { Webhook } from "standardwebhooks";

// Generate unique order ID
const generateOrderId = () => {
  return `order_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
};

// Create payment order → returns Dodo checkout URL
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const { plan } = req.body;

    if (!plan || !["starter", "creator", "pro"].includes(plan)) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const planDetails = PLANS[plan as keyof typeof PLANS];
    const orderId = generateOrderId();

    // Create Dodo Payments checkout session
    const session = await dodo.checkoutSessions.create({
      customer: {
        email: user.email,
        name: user.name,
      },
      product_cart: [
        {
          product_id: planDetails.productId,
          quantity: 1,
        },
      ],
      return_url: `${process.env.CLIENT_URL}/payment/status?order_id=${orderId}`,
      metadata: {
        order_id: orderId,
        user_id: userId as string,
        plan: plan,
      },
    });

    console.log("Dodo Payments session created:", session);

    // Save payment record
    const payment = new Payment({
      userId,
      orderId,
      paymentSessionId: session.session_id || "",
      plan,
      amount: planDetails.price,
      currency: "USD",
      status: "pending",
    });
    await payment.save();

    return res.json({
      success: true,
      checkoutUrl: session.checkout_url,
      orderId,
    });
  } catch (error: any) {
    console.error("Create order error:", error);
    res.status(500).json({
      message: error?.message || "Failed to create order",
    });
  }
};

// Verify payment status
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { orderId, paymentId } = req.body;

    if (!orderId && !paymentId) {
      return res
        .status(400)
        .json({ message: "Order ID or Payment ID is required" });
    }

    // Find payment by orderId or by paymentSessionId (which stores dodo payment_id)
    let payment;
    if (orderId) {
      payment = await Payment.findOne({ orderId });
    } else {
      payment = await Payment.findOne({ paymentSessionId: paymentId });
    }

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // If already paid, return success
    if (payment.status === "paid") {
      return res.json({ success: true, status: "paid" });
    }

    // Fetch payment status from Dodo
    try {
      console.log("Fetching Dodo payment status for:", payment.paymentSessionId);
      const dodoSession = await dodo.checkoutSessions.retrieve(payment.paymentSessionId);
      console.log("Dodo payment response:", JSON.stringify(dodoSession, null, 2));

      const status = (dodoSession.payment_status || "").toLowerCase();

      if (status === "succeeded" || status === "completed" || status === "paid") {
        payment.status = "paid";
        if (dodoSession.payment_id) {
            payment.dodoPaymentId = dodoSession.payment_id;
        }
        await payment.save();

        // Update user plan and add credits
        const planDetails = PLANS[payment.plan as keyof typeof PLANS];
        await User.findByIdAndUpdate(payment.userId, {
          plan: payment.plan,
          $inc: {
            credits: planDetails.credits,
            totalCredits: planDetails.credits,
          },
        });

        return res.json({ success: true, status: "paid" });
      } else if (status === "failed" || status === "cancelled" || status === "expired") {
        payment.status = "failed";
        await payment.save();
        return res.json({ success: false, status: "failed" });
      } else {
        console.log("Dodo payment status is:", status, "- treating as pending");
      }
    } catch (fetchError: any) {
      console.error("Error fetching Dodo payment status:", fetchError?.message || fetchError);
    }

    return res.json({ success: false, status: "pending" });
  } catch (error: any) {
    console.error("Verify payment error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Dodo Payments webhook handler
export const paymentWebhook = async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;

    if (webhookSecret) {
      // Verify webhook signature
      const wh = new Webhook(webhookSecret);
      const headers = {
        "webhook-id": req.headers["webhook-id"] as string,
        "webhook-signature": req.headers["webhook-signature"] as string,
        "webhook-timestamp": req.headers["webhook-timestamp"] as string,
      };
      try {
        wh.verify(JSON.stringify(req.body), headers);
      } catch (verifyError) {
        console.error("Webhook signature verification failed:", verifyError);
        return res.status(401).json({ message: "Invalid signature" });
      }
    }

    const { event_type, data } = req.body;

    if (!data) {
      return res.status(400).json({ message: "Invalid webhook data" });
    }

    const paymentId = data.payment_id;
    const metadata = data.metadata || {};

    // Find payment by paymentSessionId or by metadata.order_id
    let payment;
    if (paymentId) {
      payment = await Payment.findOne({ paymentSessionId: paymentId });
    }
    if (!payment && metadata.order_id) {
      payment = await Payment.findOne({ orderId: metadata.order_id });
    }

    if (!payment) {
      console.log("Webhook: Payment not found for:", { paymentId, metadata });
      return res.status(404).json({ message: "Payment not found" });
    }

    if (event_type === "payment.succeeded" && payment.status !== "paid") {
      payment.status = "paid";
      payment.dodoPaymentId = paymentId;
      await payment.save();

      // Update user plan and add credits (top-up)
      const planDetails = PLANS[payment.plan as keyof typeof PLANS];
      await User.findByIdAndUpdate(payment.userId, {
        plan: payment.plan,
        $inc: {
          credits: planDetails.credits,
          totalCredits: planDetails.credits,
        },
      });

      console.log("Webhook: Payment succeeded for order:", payment.orderId);
    } else if (event_type === "payment.failed") {
      payment.status = "failed";
      await payment.save();
      console.log("Webhook: Payment failed for order:", payment.orderId);
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get user's payment history
export const getPaymentHistory = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;

    const payments = await Payment.find({ userId, status: "paid" })
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({ payments });
  } catch (error: any) {
    console.error("Get payment history error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Activate free plan
export const activateFreePlan = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user already has a plan
    if (user.plan !== "none") {
      return res
        .status(400)
        .json({ message: "You already have an active plan" });
    }

    // Activate free plan with 25 credits
    user.plan = "free";
    user.credits = 25;
    user.totalCredits = 25;
    await user.save();

    return res.json({
      success: true,
      message: "Free plan activated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        credits: user.credits,
        totalCredits: user.totalCredits,
      },
    });
  } catch (error: any) {
    console.error("Activate free plan error:", error);
    res.status(500).json({ message: error.message });
  }
};
