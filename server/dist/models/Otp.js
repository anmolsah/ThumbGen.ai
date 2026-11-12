import mongoose from 'mongoose';
const OtpSchema = new mongoose.Schema({
    email: { type: String, required: true, lowercase: true },
    otp: { type: String, required: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });
const Otp = mongoose.models.Otp || mongoose.model('Otp', OtpSchema);
export default Otp;
