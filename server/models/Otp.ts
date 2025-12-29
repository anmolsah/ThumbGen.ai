import mongoose from 'mongoose';

export interface IOtp extends Document {
    email: string;
    otp: string;
    name: string;
    password: string;
    expiresAt: Date;
    createdAt?: Date;
}

const OtpSchema = new mongoose.Schema<IOtp>(
    {
        email: { type: String, required: true, lowercase: true },
        otp: { type: String, required: true },
        name: { type: String, required: true },
        password: { type: String, required: true },
        expiresAt: { type: Date, required: true, index: { expires: 0 } },
    },
    { timestamps: true }
);

const Otp = mongoose.models.Otp || mongoose.model<IOtp>('Otp', OtpSchema);

export default Otp;
