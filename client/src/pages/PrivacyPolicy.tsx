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
          <p className="text-gray-400 mb-10">
            Last updated: March 16, 2026 &nbsp;|&nbsp; Effective from: March 16,
            2026
          </p>

          <div className="space-y-8 text-gray-300">
            <section>
              <p className="leading-relaxed">
                ThumbGen.ai ("ThumbGen", "we", "us", or "our") is committed to
                protecting and respecting your privacy. This Privacy Policy
                explains how we collect, use, disclose, and safeguard your
                personal information when you access or use our website at{" "}
                <a
                  href="https://thumbgen.online"
                  className="text-brand-400 hover:underline"
                >
                  thumbgen.online
                </a>{" "}
                and any associated services, features, or applications
                (collectively, the "Platform").
              </p>
              <p className="leading-relaxed mt-3">
                By accessing or using the Platform, you signify that you have
                read, understood, and agree to be bound by this Privacy Policy.
                If you do not agree with the terms of this Privacy Policy, you
                should not access or use the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                1. Information We Collect
              </h2>
              <p className="leading-relaxed mb-3">
                We may collect the following categories of information when you
                interact with our Platform:
              </p>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                1.1 Information You Provide Directly
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>
                  <strong className="text-gray-300">Account Information:</strong>{" "}
                  When you register for an account, we collect your full name,
                  email address, and an encrypted version of your password.
                </li>
                <li>
                  <strong className="text-gray-300">Payment Information:</strong>{" "}
                  When you subscribe to a paid plan, we collect billing details
                  required to process transactions. Payment processing is handled
                  by our third-party payment processor, Dodo Payments. We do
                  not store your credit card, debit card, or bank account
                  numbers on our servers. Please refer to{" "}
                  <a
                    href="https://dodopayments.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-400 hover:underline"
                  >
                    Dodo Payments' Privacy Policy
                  </a>{" "}
                  for details on how your payment data is handled.
                </li>
                <li>
                  <strong className="text-gray-300">User Content:</strong>{" "}
                  Prompts, titles, style preferences, and any text inputs you
                  provide to generate thumbnails, as well as reference images you
                  upload (available on Creator and Pro plans).
                </li>
                <li>
                  <strong className="text-gray-300">Communications:</strong> Any
                  information you provide when you contact us for support or
                  feedback, including the content of your messages.
                </li>
              </ul>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                1.2 Information Collected Automatically
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>
                  <strong className="text-gray-300">Log Data:</strong> IP
                  address, browser type and version, operating system, referring
                  URL, pages visited, date and time of access, and time spent on
                  pages.
                </li>
                <li>
                  <strong className="text-gray-300">
                    Device Information:
                  </strong>{" "}
                  Device type, screen resolution, unique device identifiers, and
                  general hardware information.
                </li>
                <li>
                  <strong className="text-gray-300">
                    Cookies & Session Data:
                  </strong>{" "}
                  We use essential cookies to maintain your authenticated session
                  and remember your preferences. For more details, see Section 5
                  (Cookies).
                </li>
              </ul>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                1.3 Information from Third-Party Services
              </h3>
              <p className="leading-relaxed text-gray-400">
                We may receive information about you from third-party services
                integrated into our Platform, such as analytics providers and
                payment processors, to the extent permitted by their respective
                privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                2. How We Use Your Information
              </h2>
              <p className="leading-relaxed mb-3">
                We use the information we collect for the following purposes:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>
                  <strong className="text-gray-300">
                    Service Delivery:
                  </strong>{" "}
                  To create and manage your account, process your thumbnail
                  generation requests, manage your credit balance, and deliver
                  the services you have requested.
                </li>
                <li>
                  <strong className="text-gray-300">
                    Payment Processing:
                  </strong>{" "}
                  To process subscription payments, verify transactions, and
                  manage billing-related communications.
                </li>
                <li>
                  <strong className="text-gray-300">
                    Service Improvement:
                  </strong>{" "}
                  To understand how users interact with our Platform, identify
                  areas for improvement, develop new features, and optimize the
                  performance and quality of our AI models.
                </li>
                <li>
                  <strong className="text-gray-300">Communication:</strong> To
                  send you transactional emails (e.g., OTP verification, payment
                  confirmations), respond to your inquiries, and provide
                  customer support.
                </li>
                <li>
                  <strong className="text-gray-300">
                    Security & Fraud Prevention:
                  </strong>{" "}
                  To detect, investigate, and prevent unauthorized access,
                  fraudulent activity, abuse, and other harmful or illegal
                  activities on the Platform.
                </li>
                <li>
                  <strong className="text-gray-300">Legal Compliance:</strong>{" "}
                  To comply with applicable laws, regulations, legal processes,
                  or enforceable governmental requests.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                3. Sharing and Disclosure of Information
              </h2>
              <p className="leading-relaxed mb-3">
                We do not sell, rent, or lease your personal information to third
                parties for their marketing purposes. We may share your
                information in the following limited circumstances:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>
                  <strong className="text-gray-300">Service Providers:</strong>{" "}
                  We share data with trusted third-party service providers who
                  assist us in operating the Platform. These providers are
                  contractually obligated to use your data only for the purposes
                  we specify and in accordance with this Privacy Policy. Our
                  current service providers include:
                  <ul className="list-disc list-inside ml-5 mt-2 space-y-1">
                    <li>
                      Google Cloud (Imagen & Gemini APIs) — for AI-powered image
                      generation
                    </li>
                    <li>
                      Cloudinary — for secure cloud-based image storage and
                      delivery
                    </li>
                    <li>Dodo Payments — for payment processing</li>
                    <li>Brevo (Sendinblue) — for transactional email delivery</li>
                    <li>MongoDB Atlas — for database hosting</li>
                    <li>Upstash — for Redis-based queue management</li>
                    <li>Vercel — for application hosting and deployment</li>
                  </ul>
                </li>
                <li>
                  <strong className="text-gray-300">Legal Requirements:</strong>{" "}
                  We may disclose your information if required to do so by law,
                  in response to a court order, subpoena, or other legal process,
                  or if we believe in good faith that disclosure is necessary to
                  protect our rights, your safety, the safety of others,
                  investigate fraud, or respond to a government request.
                </li>
                <li>
                  <strong className="text-gray-300">
                    Business Transfers:
                  </strong>{" "}
                  In the event of a merger, acquisition, reorganization,
                  bankruptcy, or sale of all or a portion of our assets, your
                  information may be transferred as part of that transaction.
                </li>
                <li>
                  <strong className="text-gray-300">
                    Anonymized/Aggregated Data:
                  </strong>{" "}
                  We may share anonymized, aggregated, or de-identified data that
                  cannot reasonably be used to identify you for analytics,
                  research, and improvement purposes.
                </li>
                <li>
                  <strong className="text-gray-300">Showcase:</strong> With your
                  consent, generated thumbnails may be displayed anonymously in
                  our public showcase section. No personally identifiable
                  information is associated with showcased thumbnails.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                4. Data Storage, Retention, and Security
              </h2>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                4.1 Data Storage
              </h3>
              <p className="leading-relaxed text-gray-400">
                Your personal data is stored on secure servers hosted by MongoDB
                Atlas and Cloudinary. Generated thumbnails are stored on
                Cloudinary's cloud infrastructure. Our services are hosted on
                Vercel's global edge network. Data may be processed and stored in
                data centers located outside your country of residence, including
                in the United States and the European Union.
              </p>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                4.2 Data Retention
              </h3>
              <p className="leading-relaxed text-gray-400">
                We retain your personal information for as long as your account
                is active or as needed to provide you services. If you delete
                your account, we will delete or anonymize your personal data
                within 30 days, except where we are required to retain certain
                information for legal, regulatory, or legitimate business
                purposes (e.g., payment records for tax compliance). Generated
                thumbnails associated with deleted accounts will be permanently
                removed from our storage systems.
              </p>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                4.3 Security Measures
              </h3>
              <p className="leading-relaxed text-gray-400">
                We implement industry-standard security measures to protect your
                personal information, including:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-2 text-gray-400">
                <li>
                  Encryption of data in transit using TLS/SSL protocols
                </li>
                <li>
                  Passwords are hashed using bcrypt with salted hashing
                  algorithms before storage — we never store passwords in
                  plaintext
                </li>
                <li>Secure, HTTP-only session cookies with SameSite protection</li>
                <li>Regular security audits and access controls</li>
              </ul>
              <p className="leading-relaxed text-gray-400 mt-3">
                While we strive to use commercially acceptable means to protect
                your personal information, no method of transmission over the
                Internet or method of electronic storage is 100% secure. We
                cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                5. Cookies and Tracking Technologies
              </h2>
              <p className="leading-relaxed mb-3">
                We use cookies and similar tracking technologies to operate and
                improve our Platform.
              </p>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                5.1 Types of Cookies We Use
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>
                  <strong className="text-gray-300">
                    Strictly Necessary Cookies:
                  </strong>{" "}
                  These cookies are essential for the Platform to function. They
                  enable core functionality such as session management and
                  authentication. You cannot opt out of these cookies as the
                  Platform would not function without them.
                </li>
                <li>
                  <strong className="text-gray-300">
                    Preference Cookies:
                  </strong>{" "}
                  These cookies remember your settings and preferences (e.g.,
                  preferred style, color scheme) to provide a more personalized
                  experience.
                </li>
              </ul>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                5.2 Managing Cookies
              </h3>
              <p className="leading-relaxed text-gray-400">
                Most web browsers allow you to control cookies through their
                settings. You can configure your browser to refuse all cookies or
                to indicate when a cookie is being sent. However, disabling
                cookies may affect the functionality of the Platform, and certain
                features may not work as intended.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                6. Your Rights and Choices
              </h2>
              <p className="leading-relaxed mb-3">
                Depending on your jurisdiction, you may have the following rights
                regarding your personal information:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>
                  <strong className="text-gray-300">Right of Access:</strong> You
                  may request a copy of the personal data we hold about you.
                </li>
                <li>
                  <strong className="text-gray-300">
                    Right to Rectification:
                  </strong>{" "}
                  You may request correction of inaccurate or incomplete personal
                  data.
                </li>
                <li>
                  <strong className="text-gray-300">Right to Erasure:</strong>{" "}
                  You may request deletion of your account and all associated
                  personal data. Upon deletion, your generated thumbnails,
                  prompts, and account information will be permanently removed.
                </li>
                <li>
                  <strong className="text-gray-300">
                    Right to Data Portability:
                  </strong>{" "}
                  You may request to export your generated thumbnails and account
                  data in a commonly used, machine-readable format.
                </li>
                <li>
                  <strong className="text-gray-300">
                    Right to Restrict Processing:
                  </strong>{" "}
                  You may request that we limit the processing of your personal
                  data under certain circumstances.
                </li>
                <li>
                  <strong className="text-gray-300">Right to Object:</strong> You
                  may object to the processing of your personal data for direct
                  marketing or profiling purposes.
                </li>
                <li>
                  <strong className="text-gray-300">
                    Right to Withdraw Consent:
                  </strong>{" "}
                  Where we rely on your consent to process your data, you may
                  withdraw that consent at any time without affecting the
                  lawfulness of processing based on consent before its
                  withdrawal.
                </li>
              </ul>
              <p className="leading-relaxed text-gray-400 mt-3">
                To exercise any of these rights, please contact us at the email
                address provided in Section 11. We will respond to your request
                within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                7. Children's Privacy
              </h2>
              <p className="leading-relaxed">
                Our Platform is not intended for individuals under the age of 13
                (or the applicable age of digital consent in your jurisdiction).
                We do not knowingly collect personal information from children
                under 13. If we become aware that we have inadvertently
                collected personal data from a child under 13, we will take
                steps to delete such information from our records as promptly as
                possible. If you are a parent or guardian and believe that your
                child has provided us with personal information, please contact
                us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                8. Third-Party Links and Services
              </h2>
              <p className="leading-relaxed">
                The Platform may contain links to third-party websites,
                services, or applications that are not operated by us. This
                Privacy Policy does not apply to third-party services, and we
                are not responsible for the content, privacy policies, or
                practices of any third-party services. We encourage you to
                review the privacy policies of any third-party services you
                access through links on our Platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                9. International Data Transfers
              </h2>
              <p className="leading-relaxed">
                Your information may be transferred to — and maintained on —
                servers located outside of your state, province, country, or
                other governmental jurisdiction where data protection laws may
                differ from those of your jurisdiction. If you are located
                outside India and choose to provide information to us, please
                note that we transfer the data to India and other countries and
                process it there. Your consent to this Privacy Policy followed
                by your submission of such information represents your agreement
                to such transfer.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                10. Changes to This Privacy Policy
              </h2>
              <p className="leading-relaxed">
                We reserve the right to update or modify this Privacy Policy at
                any time. When we make material changes, we will notify you by
                updating the "Last updated" date at the top of this page and, for
                significant changes, by sending a notification to the email
                address associated with your account or by placing a prominent
                notice on our Platform. Your continued use of the Platform after
                any modifications to this Privacy Policy constitutes your
                acceptance of the revised terms. We encourage you to review this
                Privacy Policy periodically.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                11. Grievance Officer and Contact Information
              </h2>
              <p className="leading-relaxed">
                If you have any questions, concerns, or complaints about this
                Privacy Policy, our data practices, or if you wish to exercise
                any of your rights as described above, please contact our
                Grievance Officer at:
              </p>
              <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10 text-gray-400 space-y-1">
                <p>
                  <strong className="text-gray-300">Grievance Officer:</strong>{" "}
                  Anmol Sah
                </p>
                <p>
                  <strong className="text-gray-300">Company:</strong>{" "}
                  ThumbGen.ai
                </p>
                <p>
                  <strong className="text-gray-300">Email:</strong>{" "}
                  <a
                    href="mailto:annifind010@gmail.com"
                    className="text-brand-400 hover:underline"
                  >
                    annifind010@gmail.com
                  </a>
                </p>
                <p>
                  <strong className="text-gray-300">Response Time:</strong>{" "}
                  We will acknowledge your request within 48 hours and resolve it
                  within 30 days of receipt.
                </p>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </>
  );
}
