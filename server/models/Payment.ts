import mongoose from "mongoose";

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  orderId: string;
  paymentSessionId: string;
  plan: "creator" | "pro";
  amount: number;
  status: "pending" | "paid" | "failed";
  cfPaymentId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const PaymentSchema = new mongoose.Schema<IPayment>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderId: { type: String, required: true, unique: true },
    paymentSessionId: { type: String },
    plan: { type: String, enum: ["creator", "pro"], required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    cfPaymentId: { type: String },
  },
  { timestamps: true }
);

const Payment =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;
