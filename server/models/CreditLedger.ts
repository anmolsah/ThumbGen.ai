/**
 * models/CreditLedger.ts
 *
 * Append-only credit ledger schema (PLAN.md Section 8).
 * Tracks every credit mutation: reserve | commit | refund | grant | adjust.
 */

import mongoose, { Document, Schema } from "mongoose";

export type LedgerEntryType =
  | "reserve"
  | "commit"
  | "refund"
  | "grant"
  | "adjust";

export interface ICreditLedger extends Document {
  user_id: string;
  job_id: string | null;
  type: LedgerEntryType;
  delta: number;
  balance_after: number;
  reason: string;
  idempotency_key: string;
  created_at: Date;
}

const CreditLedgerSchema = new Schema<ICreditLedger>(
  {
    user_id: {
      type: String,
      ref: "User",
      required: true,
      index: true,
    },
    job_id: {
      type: String,
      ref: "Job",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ["reserve", "commit", "refund", "grant", "adjust"],
      required: true,
    },
    delta: {
      type: Number,
      required: true,
    },
    balance_after: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    idempotency_key: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "credit_ledger",
  }
);

// Guarantees each (user_id, idempotency_key, type) tuple can only be written once
CreditLedgerSchema.index(
  { user_id: 1, idempotency_key: 1, type: 1 },
  { unique: true }
);
CreditLedgerSchema.index({ user_id: 1, created_at: -1 });

const CreditLedger =
  mongoose.models.CreditLedger ||
  mongoose.model<ICreditLedger>("CreditLedger", CreditLedgerSchema);

export default CreditLedger;

