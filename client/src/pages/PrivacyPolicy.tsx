import { motion } from "motion/react";
import SoftBackdrop from "../components/SoftBackdrop";

export default function PrivacyPolicy() {
  return (
    <>
      <SoftBackdrop />
      <div className="min-h-screen pt-28 pb-20 px-4 md:px-16 lg:px-24 xl:px-32">
        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-gray-400 mb-10">Last updated: December 30, 2024</p>

          <div className="space-y-8 text-gray-300">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                1. Information We Collect
              </h2>
              <p className="leading-relaxed">
                We collect information you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
                <li>Name and email address when you create an account</li>
                <li>Payment information when you subscribe to a plan</li>
                <li>Thumbnails and prompts you generate using our service</li>
                <li>Reference images you upload (Creator/Pro plans)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                2. How We Use Your Information
              </h2>
              <p className="leading-relaxed">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                3. Data Storage & Security
              </h2>
              <p className="leading-relaxed">
                Your data is stored securely using industry-standard encryption.
                Generated thumbnails are stored on Cloudinary's secure servers.
                We do not sell or share your personal information with third
                parties for marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                4. Cookies
              </h2>
              <p className="leading-relaxed">
                We use cookies to maintain your session and remember your
                preferences. These are essential for the service to function
                properly.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                5. Your Rights
              </h2>
              <p className="leading-relaxed">You have the right to:</p>
              <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
                <li>Access your personal data</li>
                <li>Delete your account and associated data</li>
                <li>Export your generated thumbnails</li>
                <li>Opt out of promotional communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                6. Third-Party Services
              </h2>
              <p className="leading-relaxed">
                We use the following third-party services:
              </p>
              <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
                <li>Google AI (Imagen & Gemini) for image generation</li>
                <li>Cloudinary for image storage</li>
                <li>Cashfree for payment processing</li>
                <li>Brevo for email communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                7. Contact Us
              </h2>
              <p className="leading-relaxed">
                If you have any questions about this Privacy Policy, please
                contact us at{" "}
                <a
                  href="mailto:support@thumbgen.ai"
                  className="text-brand-400 hover:underline"
                >
                  annifind010@gmail.com
                </a>
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </>
  );
}
