import mongoose from "mongoose";
const PaymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    orderId: { type: String, required: true, unique: true },
    paymentSessionId: { type: String },
    plan: { type: String, enum: ["starter", "creator", "pro"], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    status: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending",
    },
    dodoPaymentId: { type: String },
}, { timestamps: true });
const Payment = mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
export default Payment;
