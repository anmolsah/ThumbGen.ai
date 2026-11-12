import mongoose, { Schema } from "mongoose";
const GenerationLogSchema = new Schema({
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
    content_brief: { type: Schema.Types.Mixed },
    creative_direction: { type: Schema.Types.Mixed },
    composition_plan: { type: Schema.Types.Mixed },
    design_qa_result: { type: Schema.Types.Mixed },
    resolution_actual: {
        width: { type: Number },
        height: { type: Number },
        tier: { type: String },
    },
}, {
    timestamps: { createdAt: "created_at", updatedAt: false },
});
const GenerationLog = mongoose.models.GenerationLog ||
    mongoose.model("GenerationLog", GenerationLogSchema);
export default GenerationLog;
