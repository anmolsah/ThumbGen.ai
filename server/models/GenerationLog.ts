import mongoose, { Document, Schema } from "mongoose";

export interface IGenerationLog extends Document {
  job_id: string;
  user_id: string;
  request_id: string;
  mode: string;
  provider: string;
  model_id: string;
  attempt: number;
  latency_ms: number;
  billed_cost_usd: number | null;
  reserved_credits: number;
  final_credits: number;
  status: "succeeded" | "failed";
  error_code: string | null;
  request_params: Record<string, unknown>;
  resolution_actual?: {
    width: number;
    height: number;
    tier: string;
  };
  created_at: Date;
}

const GenerationLogSchema = new Schema<IGenerationLog>(
  {
    job_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
    request_id: { type: String, required: true },
    mode: { type: String, required: true, index: true },
    provider: { type: String, required: true, index: true },
    model_id: { type: String, required: true, index: true },
    attempt: { type: Number, required: true, default: 1 },
    latency_ms: { type: Number, required: true },
    billed_cost_usd: { type: Number, default: null },
    reserved_credits: { type: Number, required: true },
    final_credits: { type: Number, required: true },
    status: {
      type: String,
      enum: ["succeeded", "failed"],
      required: true,
      index: true,
    },
    error_code: { type: String, default: null },
    request_params: { type: Schema.Types.Mixed, default: {} },
    resolution_actual: {
      width: { type: Number },
      height: { type: Number },
      tier: { type: String },
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

const GenerationLog =
  mongoose.models.GenerationLog ||
  mongoose.model<IGenerationLog>("GenerationLog", GenerationLogSchema);

export default GenerationLog;

