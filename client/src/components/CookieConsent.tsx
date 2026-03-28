import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CookieIcon, XIcon } from "lucide-react";

const COOKIE_CONSENT_KEY = "cookie-consent";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay so it doesn't flash on load
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "rejected");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-slide-up">
      <div className="relative rounded-2xl border border-white/10 bg-zinc-900/90 backdrop-blur-xl shadow-2xl p-5">
        {/* Close button */}
        <button
          onClick={handleReject}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition"
          aria-label="Close"
        >
          <XIcon className="size-4 text-zinc-400" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 size-9 rounded-full bg-brand-500/15 flex items-center justify-center">
            <CookieIcon className="size-5 text-brand-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              We use cookies
            </h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              We use cookies to keep you logged in and improve your experience.
              By clicking "Accept", you consent to our use of cookies. Learn
              more in our{" "}
              <Link
                to="/privacy"
                className="text-brand-400 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleReject}
            className="flex-1 py-2 rounded-lg border border-white/10 text-sm font-medium text-zinc-300 hover:bg-white/6 transition"
          >
            Reject
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-sm font-medium text-white transition"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
