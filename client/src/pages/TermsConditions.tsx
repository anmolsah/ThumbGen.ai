import { motion } from "motion/react";
import SoftBackdrop from "../components/SoftBackdrop";

export default function TermsConditions() {
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
          <h1 className="text-4xl font-bold mb-2">Terms & Conditions</h1>
          <p className="text-gray-400 mb-10">Last updated: December 30, 2024</p>

          <div className="space-y-8 text-gray-300">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                1. Acceptance of Terms
              </h2>
              <p className="leading-relaxed">
                By accessing and using ThumbGen.ai, you agree to be bound by
                these Terms and Conditions. If you do not agree with any part of
                these terms, please do not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                2. Service Description
              </h2>
              <p className="leading-relaxed">
                ThumbGen.ai is an AI-powered thumbnail generation service. We
                provide tools to create thumbnails for videos using artificial
                intelligence. The quality and output may vary based on the
                prompts and settings you provide.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                3. User Accounts
              </h2>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>
                  You must provide accurate information when creating an account
                </li>
                <li>
                  You are responsible for maintaining the security of your
                  account
                </li>
                <li>You must be at least 13 years old to use this service</li>
                <li>
                  One account per person; sharing accounts is not permitted
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                4. Credits & Payments
              </h2>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>Credits are required to generate thumbnails</li>
                <li>Free plan: 25 credits (5 thumbnails with watermark)</li>
                <li>Creator plan: 200 credits/month (₹299)</li>
                <li>Pro plan: 800 credits/month (₹799)</li>
                <li>Credits do not roll over to the next billing cycle</li>
                <li>Refunds are handled on a case-by-case basis</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                5. Content Ownership
              </h2>
              <p className="leading-relaxed">
                You retain ownership of the thumbnails you generate. However,
                you grant us a license to display generated thumbnails in our
                showcase section (anonymously). You are responsible for ensuring
                you have rights to any reference images you upload.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                6. Prohibited Uses
              </h2>
              <p className="leading-relaxed mb-3">
                You agree not to use ThumbGen.ai to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>Generate illegal, harmful, or offensive content</li>
                <li>Infringe on intellectual property rights</li>
                <li>Create misleading or deceptive thumbnails</li>
                <li>Attempt to reverse engineer or hack the service</li>
                <li>Resell or redistribute the service without permission</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                7. Service Availability
              </h2>
              <p className="leading-relaxed">
                We strive to maintain 99.9% uptime but do not guarantee
                uninterrupted service. We may modify, suspend, or discontinue
                features at any time. Scheduled maintenance will be communicated
                in advance when possible.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                8. Limitation of Liability
              </h2>
              <p className="leading-relaxed">
                ThumbGen.ai is provided "as is" without warranties of any kind.
                We are not liable for any indirect, incidental, or consequential
                damages arising from your use of the service. Our total
                liability is limited to the amount you paid in the last 12
                months.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                9. Changes to Terms
              </h2>
              <p className="leading-relaxed">
                We may update these terms from time to time. Continued use of
                the service after changes constitutes acceptance of the new
                terms. We will notify users of significant changes via email.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                10. Contact
              </h2>
              <p className="leading-relaxed">
                For questions about these Terms & Conditions, contact us at{" "}
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
