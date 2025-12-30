import { Request, Response } from "express";
import { cashfree, PLANS } from "../configs/cashfree.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import crypto from "crypto";

// Generate unique order ID
const generateOrderId = () => {
  return `order_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
};

// Create payment order
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const { plan } = req.body;

    if (!plan || !["creator", "pro"].includes(plan)) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const planDetails = PLANS[plan as keyof typeof PLANS];
    const orderId = generateOrderId();

    // Create Cashfree order
    const orderRequest = {
      order_id: orderId,
      order_amount: planDetails.price,
      order_currency: "INR",
      customer_details: {
        customer_id: userId as string,
        customer_name: user.name,
        customer_email: user.email,
        customer_phone: "9999999999", // Default phone, can be updated
      },
      order_meta: {
        return_url: `${process.env.CLIENT_URL}/payment/status?order_id={order_id}`,
      },
      order_note: `${planDetails.name} subscription`,
    };

    console.log("Creating Cashfree order:", orderRequest);
    const response = await cashfree.PGCreateOrder(orderRequest);
    console.log("Cashfree response:", JSON.stringify(response.data, null, 2));

    if (response.data && response.data.payment_session_id) {
      // Save payment record
      const payment = new Payment({
        userId,
        orderId,
        paymentSessionId: response.data.payment_session_id,
        plan,
        amount: planDetails.price,
        status: "pending",
      });
      await payment.save();

      return res.json({
        success: true,
        paymentSessionId: response.data.payment_session_id,
        orderId,
      });
    }

    return res.status(500).json({
      message: "Failed to create order",
      details: response.data,
    });
  } catch (error: any) {
    console.error("Create order error:", error?.response?.data || error);
    res.status(500).json({
      message: error?.response?.data?.message || error.message,
      code: error?.response?.data?.code,
    });
  }
};

// Verify payment status
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // If already paid, return success
    if (payment.status === "paid") {
      return res.json({ success: true, status: "paid" });
    }

    // Fetch order status from Cashfree
    const response = await cashfree.PGOrderFetchPayments(orderId);

    if (response.data && response.data.length > 0) {
      const latestPayment = response.data[0];

      if (latestPayment.payment_status === "SUCCESS") {
        // Update payment record
        payment.status = "paid";
        payment.cfPaymentId = latestPayment.cf_payment_id?.toString();
        await payment.save();

        // Update user plan and credits
        const planDetails = PLANS[payment.plan as keyof typeof PLANS];
        await User.findByIdAndUpdate(payment.userId, {
          plan: payment.plan,
          credits: planDetails.credits,
          totalCredits: planDetails.credits,
        });

        return res.json({ success: true, status: "paid" });
      } else if (latestPayment.payment_status === "FAILED") {
        payment.status = "failed";
        await payment.save();
        return res.json({ success: false, status: "failed" });
      }
    }

    return res.json({ success: false, status: "pending" });
  } catch (error: any) {
    console.error("Verify payment error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Cashfree webhook handler
export const paymentWebhook = async (req: Request, res: Response) => {
  try {
    const { data } = req.body;

    if (!data || !data.order || !data.payment) {
      return res.status(400).json({ message: "Invalid webhook data" });
    }

    const orderId = data.order.order_id;
    const paymentStatus = data.payment.payment_status;

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (paymentStatus === "SUCCESS" && payment.status !== "paid") {
      payment.status = "paid";
      payment.cfPaymentId = data.payment.cf_payment_id?.toString();
      await payment.save();

      // Update user plan and credits
      const planDetails = PLANS[payment.plan as keyof typeof PLANS];
      await User.findByIdAndUpdate(payment.userId, {
        plan: payment.plan,
        credits: planDetails.credits,
        totalCredits: planDetails.credits,
      });
    } else if (paymentStatus === "FAILED") {
      payment.status = "failed";
      await payment.save();
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
