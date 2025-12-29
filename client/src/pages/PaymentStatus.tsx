import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2Icon, XCircleIcon, Loader2Icon } from "lucide-react";
import api from "../configs/api";
import { useAuth } from "../context/AuthContext";

const PaymentStatus = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [status, setStatus] = useState<
    "loading" | "success" | "failed" | "pending"
  >("loading");
  const orderId = searchParams.get("order_id");

  useEffect(() => {
    const verifyPayment = async () => {
      if (!orderId) {
        setStatus("failed");
        return;
      }

      try {
        const { data } = await api.post("/api/payment/verify", { orderId });

        if (data.success && data.status === "paid") {
          setStatus("success");
          // Refresh user data to get updated plan
          const userResponse = await api.get("/api/auth/verify");
          if (userResponse.data.user) {
            setUser(userResponse.data.user);
          }
        } else if (data.status === "failed") {
          setStatus("failed");
        } else {
          setStatus("pending");
        }
      } catch (error) {
        console.error(error);
        setStatus("failed");
      }
    };

    verifyPayment();
  }, [orderId]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {status === "loading" && (
          <div className="bg-white/6 border border-white/10 rounded-2xl p-8">
            <Loader2Icon className="size-16 text-teal-400 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Verifying Payment</h1>
            <p className="text-gray-400">
              Please wait while we confirm your payment...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="bg-white/6 border border-teal-800 rounded-2xl p-8">
            <div className="size-20 bg-teal-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2Icon className="size-12 text-teal-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-teal-400">
              Payment Successful!
            </h1>
            <p className="text-gray-400 mb-6">
              Your plan has been upgraded successfully. You can now enjoy all
              the premium features.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/profile")}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 rounded-xl font-medium transition"
              >
                View Profile
              </button>
              <button
                onClick={() => navigate("/generate")}
                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition"
              >
                Start Generating
              </button>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="bg-white/6 border border-red-800 rounded-2xl p-8">
            <div className="size-20 bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircleIcon className="size-12 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-red-400">
              Payment Failed
            </h1>
            <p className="text-gray-400 mb-6">
              Something went wrong with your payment. Please try again or
              contact support.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/profile")}
                className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl font-medium transition"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate("/")}
                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition"
              >
                Go Home
              </button>
            </div>
          </div>
        )}

        {status === "pending" && (
          <div className="bg-white/6 border border-amber-800 rounded-2xl p-8">
            <div className="size-20 bg-amber-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2Icon className="size-12 text-amber-400 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-amber-400">
              Payment Pending
            </h1>
            <p className="text-gray-400 mb-6">
              Your payment is being processed. This may take a few moments.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 rounded-xl font-medium transition"
            >
              Check Status
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentStatus;
