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
          <p className="text-gray-400 mb-10">
            Last updated: March 16, 2026 &nbsp;|&nbsp; Effective from: March 16,
            2026
          </p>

          <div className="space-y-8 text-gray-300">
            <section>
              <p className="leading-relaxed">
                These Terms and Conditions ("Terms", "Agreement") constitute a
                legally binding agreement between you ("User", "you", or "your")
                and ThumbGen.ai ("ThumbGen", "Company", "we", "us", or "our"),
                governing your access to and use of the website at{" "}
                <a
                  href="https://thumbgen.online"
                  className="text-brand-400 hover:underline"
                >
                  thumbgen.online
                </a>{" "}
                and all related services, features, content, and applications
                (collectively, the "Platform").
              </p>
              <p className="leading-relaxed mt-3">
                Please read these Terms carefully before using the Platform. By
                creating an account, accessing, or using any part of the
                Platform, you acknowledge that you have read, understood, and
                agree to be bound by these Terms. If you do not agree to these
                Terms, you must not access or use the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                1. Eligibility
              </h2>
              <p className="leading-relaxed">
                To use the Platform, you must:
              </p>
              <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
                <li>
                  Be at least 13 years of age (or the minimum age of digital
                  consent in your jurisdiction, whichever is higher).
                </li>
                <li>
                  Have the legal capacity to enter into a binding agreement under
                  applicable law.
                </li>
                <li>
                  Not be barred from using the Platform under any applicable law
                  or regulation.
                </li>
              </ul>
              <p className="leading-relaxed mt-3 text-gray-400">
                If you are using the Platform on behalf of an organization, you
                represent and warrant that you have the authority to bind such
                organization to these Terms, and references to "you" and "your"
                will refer to both you individually and the organization.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                2. Description of Services
              </h2>
              <p className="leading-relaxed">
                ThumbGen.ai is an artificial intelligence-powered thumbnail
                generation platform. We utilize advanced AI models (Google Imagen
                and Gemini) to create visually compelling thumbnails based on
                user-provided prompts, styles, and preferences. Our services
                include but are not limited to:
              </p>
              <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
                <li>
                  AI-powered thumbnail image generation from text prompts
                </li>
                <li>
                  Multiple style options (Bold & Graphic, Tech/Futuristic,
                  Minimalist, Photorealistic, Illustrated)
                </li>
                <li>
                  Customizable aspect ratios (16:9, 1:1, 9:16) and color schemes
                </li>
                <li>
                  Reference image integration for Creator and Pro plan
                  subscribers
                </li>
                <li>
                  Cloud storage for generated thumbnails via Cloudinary
                </li>
                <li>YouTube-style thumbnail preview</li>
              </ul>
              <p className="leading-relaxed mt-3 text-gray-400">
                The quality, accuracy, and output of generated thumbnails may
                vary depending on the prompts, preferences, and settings you
                provide. AI-generated content is inherently probabilistic & we do
                not guarantee specific output results.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                3. User Accounts
              </h2>
              <h3 className="text-base font-medium text-white mt-4 mb-2">
                3.1 Registration
              </h3>
              <p className="leading-relaxed text-gray-400">
                To access certain features of the Platform, you must create an
                account by providing accurate, current, and complete information.
                You agree to update your account information promptly to keep it
                accurate and current.
              </p>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                3.2 Account Security
              </h3>
              <p className="leading-relaxed text-gray-400">
                You are responsible for safeguarding your account credentials
                and for all activities that occur under your account. You agree
                to immediately notify us of any unauthorized use of your account
                or any other breach of security. ThumbGen shall not be liable
                for any loss or damage arising from your failure to maintain the
                confidentiality of your account credentials.
              </p>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                3.3 Account Restrictions
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>
                  Each individual may maintain only one active account. Creating
                  multiple accounts to circumvent usage limits, credit
                  restrictions, or plan limitations is strictly prohibited.
                </li>
                <li>
                  Account sharing, selling, or transferring is not permitted
                  without prior written consent from ThumbGen.
                </li>
                <li>
                  We reserve the right to suspend or terminate accounts that
                  violate these Terms or are involved in fraudulent activity.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                4. Plans, Credits, and Payments
              </h2>
              <h3 className="text-base font-medium text-white mt-4 mb-2">
                4.1 Subscription Plans
              </h3>
              <p className="leading-relaxed text-gray-400">
                ThumbGen offers the following subscription plans, each providing
                a specific allocation of credits for thumbnail generation:
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm text-gray-400 border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 pr-4 text-gray-300">
                        Plan
                      </th>
                      <th className="text-left py-2 pr-4 text-gray-300">
                        Credits
                      </th>
                      <th className="text-left py-2 pr-4 text-gray-300">
                        Price
                      </th>
                      <th className="text-left py-2 text-gray-300">
                        Features
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/5">
                      <td className="py-2 pr-4">Starter (Free)</td>
                      <td className="py-2 pr-4">25 credits</td>
                      <td className="py-2 pr-4">₹0</td>
                      <td className="py-2">
                        5 thumbnails with watermark
                      </td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2 pr-4">Creator</td>
                      <td className="py-2 pr-4">200 credits</td>
                      <td className="py-2 pr-4">₹299</td>
                      <td className="py-2">
                        No watermark, reference image upload
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">Pro</td>
                      <td className="py-2 pr-4">800 credits</td>
                      <td className="py-2 pr-4">₹799</td>
                      <td className="py-2">
                        No watermark, reference image upload, priority
                        generation
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                4.2 Credit System
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>
                  Each standard thumbnail generation consumes 5 credits. Generation using a reference image consumes 15 credits.
                </li>
                <li>
                  Credits are non-transferable and cannot be exchanged for cash
                  or any other form of compensation.
                </li>
                <li>
                  Credits purchased through paid plans are added to your existing
                  balance (top-up model). Unused credits from previous purchases
                  are retained.
                </li>
                <li>
                  ThumbGen reserves the right to modify credit allocations, pricing, and plan features at any time. Changes will be communicated to users in advance and will not affect credits already purchased.
                </li>
              </ul>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                4.3 Payment Terms
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>
                  All payments are processed securely through Dodo Payments,
                  our payment gateway partner. By completing a
                  payment, you agree to Dodo Payments' terms of service.
                </li>
                <li>
                  All prices are listed in Indian Rupees (INR) and are inclusive
                  of applicable taxes unless otherwise stated.
                </li>
                <li>
                  You agree to provide valid and accurate payment information.
                  ThumbGen is not responsible for any charges, fees, or penalties
                  imposed by your payment provider or bank.
                </li>
              </ul>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                4.4 Refund Policy
              </h3>
              <p className="leading-relaxed text-gray-400">
                Refund requests are evaluated on a case-by-case basis. Refunds
                may be considered in the following circumstances:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-2 text-gray-400">
                <li>
                  Technical failures on our end that prevent thumbnail generation
                  despite credits being deducted.
                </li>
                <li>Duplicate or erroneous charges.</li>
                <li>
                  Service unavailability for an extended period affecting your
                  paid subscription.
                </li>
              </ul>
              <p className="leading-relaxed text-gray-400 mt-2">
                Refunds will not be provided for dissatisfaction with
                AI-generated output quality, as results vary based on user
                inputs. To request a refund, please contact us within 7 days of
                the transaction at the email address provided in Section 14.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                5. Intellectual Property Rights
              </h2>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                5.1 Your Content
              </h3>
              <p className="leading-relaxed text-gray-400">
                You retain ownership of the thumbnails generated through the
                Platform using your prompts and inputs. You are free to use,
                download, modify, and distribute the generated thumbnails for
                personal and commercial purposes, subject to these Terms.
              </p>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                5.2 License to ThumbGen
              </h3>
              <p className="leading-relaxed text-gray-400">
                By using the Platform, you grant ThumbGen a non-exclusive,
                worldwide, royalty-free, sublicensable license to display
                generated thumbnails anonymously in our public showcase section,
                marketing materials, and social media channels for promotional
                purposes. No personally identifiable information will be
                associated with showcased thumbnails. You may opt out of the
                showcase at any time by contacting us.
              </p>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                5.3 Reference Images
              </h3>
              <p className="leading-relaxed text-gray-400">
                If you upload reference images, you represent and warrant that
                you own all rights to such images or have obtained all necessary
                permissions and licenses to use them. You are solely responsible
                for ensuring that your reference images do not infringe upon any
                third-party intellectual property rights, publicity rights, or
                other proprietary rights.
              </p>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                5.4 ThumbGen Intellectual Property
              </h3>
              <p className="leading-relaxed text-gray-400">
                The Platform, including its design, logos, trademarks, source
                code, algorithms, user interface, and all related
                documentation, is the exclusive property of ThumbGen and is
                protected by intellectual property laws. You are granted a
                limited, non-exclusive, non-transferable, revocable license to
                access and use the Platform solely for its intended purpose.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                6. Acceptable Use Policy
              </h2>
              <p className="leading-relaxed mb-3">
                You agree to use the Platform in compliance with all applicable
                laws and regulations. Specifically, you agree not to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>
                  Generate, upload, or distribute content that is illegal,
                  harmful, threatening, abusive, harassing, defamatory, vulgar,
                  obscene, sexually explicit, or otherwise objectionable.
                </li>
                <li>
                  Create thumbnails that infringe upon the intellectual property
                  rights, privacy rights, or publicity rights of any third
                  party.
                </li>
                <li>
                  Generate misleading, deceptive, or fraudulent thumbnails
                  intended to deceive viewers or manipulate engagement metrics.
                </li>
                <li>
                  Attempt to reverse engineer, decompile, disassemble, or
                  otherwise derive the source code or underlying algorithms of
                  the Platform.
                </li>
                <li>
                  Use automated tools, bots, scrapers, or other means to access
                  the Platform in a manner that exceeds reasonable usage or
                  circumvents usage limitations.
                </li>
                <li>
                  Attempt to gain unauthorized access to any portion of the
                  Platform, other user accounts, or related systems and
                  networks.
                </li>
                <li>
                  Interfere with or disrupt the integrity, performance, or
                  availability of the Platform or its underlying infrastructure.
                </li>
                <li>
                  Resell, sublicense, redistribute, or commercially exploit the
                  Platform or its services without express written permission
                  from ThumbGen.
                </li>
                <li>
                  Use the Platform to generate content that promotes violence,
                  terrorism, hate speech, discrimination, or any form of harm
                  against individuals or groups.
                </li>
              </ul>
              <p className="leading-relaxed text-gray-400 mt-3">
                ThumbGen reserves the right to review generated content and, at
                its sole discretion, remove any content that violates these
                Terms and take appropriate action, including suspending or
                terminating your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                7. Service Availability and Modifications
              </h2>
              <p className="leading-relaxed">
                ThumbGen strives to maintain high availability and reliability of
                the Platform. However, we do not guarantee uninterrupted,
                error-free, or secure access to the Platform. The Platform may
                be temporarily unavailable due to:
              </p>
              <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
                <li>
                  Scheduled maintenance (we will endeavor to provide advance
                  notice when possible).
                </li>
                <li>
                  Unscheduled downtime due to technical issues, server failures,
                  or force majeure events.
                </li>
                <li>
                  Third-party service outages (including AI model providers,
                  hosting services, and payment processors).
                </li>
              </ul>
              <p className="leading-relaxed mt-3 text-gray-400">
                We reserve the right to modify, update, suspend, or discontinue
                any feature or aspect of the Platform at any time, with or
                without notice. We will make reasonable efforts to notify users
                of significant changes that may affect their use of the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                8. AI-Generated Content Disclaimer
              </h2>
              <p className="leading-relaxed">
                Thumbnails generated by the Platform are created using artificial
                intelligence models and algorithms. You acknowledge and agree
                that:
              </p>
              <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
                <li>
                  AI-generated output is probabilistic in nature and may not
                  always meet your expectations or requirements.
                </li>
                <li>
                  ThumbGen does not guarantee the accuracy, quality,
                  appropriateness, or suitability of any AI-generated content.
                </li>
                <li>
                  AI models may occasionally produce content that is unintended,
                  inaccurate, or contains artifacts. ThumbGen is not responsible
                  for such output.
                </li>
                <li>
                  You are solely responsible for reviewing and approving any
                  generated thumbnail before using it for any purpose.
                </li>
                <li>
                  The AI models used by ThumbGen are provided by Google and are
                  subject to Google's usage policies and acceptable use
                  guidelines.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                9. Limitation of Liability
              </h2>
              <p className="leading-relaxed">
                To the maximum extent permitted by applicable law:
              </p>
              <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
                <li>
                  The Platform is provided on an "AS IS" and "AS AVAILABLE"
                  basis, without warranties of any kind, whether express,
                  implied, or statutory, including but not limited to the implied
                  warranties of merchantability, fitness for a particular
                  purpose, and non-infringement.
                </li>
                <li>
                  ThumbGen, its directors, employees, partners, agents, and
                  affiliates shall not be liable for any indirect, incidental,
                  special, consequential, or punitive damages, including but not
                  limited to loss of profits, data, revenue, business
                  opportunities, or goodwill, arising out of or in connection
                  with your use of or inability to use the Platform.
                </li>
                <li>
                  In no event shall ThumbGen's total aggregate liability to you
                  for all claims arising out of or relating to these Terms or
                  the Platform exceed the total amount paid by you to ThumbGen in
                  the twelve (12) months immediately preceding the event giving
                  rise to the claim.
                </li>
                <li>
                  ThumbGen shall not be liable for any damages, losses, or
                  consequences resulting from reliance on AI-generated content,
                  including the use of thumbnails for commercial purposes.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                10. Indemnification
              </h2>
              <p className="leading-relaxed">
                You agree to indemnify, defend, and hold harmless ThumbGen, its
                officers, directors, employees, agents, and affiliates from and
                against any and all claims, liabilities, damages, losses, costs,
                and expenses (including reasonable attorneys' fees) arising out
                of or relating to:
              </p>
              <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
                <li>
                  Your use of or access to the Platform.
                </li>
                <li>
                  Your violation of these Terms or any applicable law or
                  regulation.
                </li>
                <li>
                  Any content you generate, upload, or distribute through the
                  Platform.
                </li>
                <li>
                  Your infringement of any third-party rights, including
                  intellectual property or privacy rights.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                11. Termination
              </h2>
              <h3 className="text-base font-medium text-white mt-4 mb-2">
                11.1 Termination by You
              </h3>
              <p className="leading-relaxed text-gray-400">
                You may terminate your account at any time by contacting us at
                the email address provided in Section 14. Upon termination, your
                right to access the Platform will cease immediately, and any
                unused credits will be forfeited. We may retain certain
                information as required by law or for legitimate business
                purposes.
              </p>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                11.2 Termination by ThumbGen
              </h3>
              <p className="leading-relaxed text-gray-400">
                We reserve the right to suspend or terminate your account and
                access to the Platform at any time, with or without cause,
                including but not limited to violation of these Terms, suspected
                fraudulent activity, abuse of services, or prolonged inactivity.
                In cases of termination for cause, any unused credits will be
                forfeited. In cases of termination without cause, we will make
                reasonable efforts to provide notice and may offer a pro-rata
                refund of unused paid credits.
              </p>

              <h3 className="text-base font-medium text-white mt-4 mb-2">
                11.3 Survival
              </h3>
              <p className="leading-relaxed text-gray-400">
                The following sections shall survive termination of these Terms:
                Intellectual Property Rights, Limitation of Liability,
                Indemnification, Governing Law, and any other provisions that by
                their nature should survive termination.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                12. Governing Law and Dispute Resolution
              </h2>
              <p className="leading-relaxed">
                These Terms shall be governed by and construed in accordance with
                the laws of India, without regard to its conflict of law
                provisions. Any disputes arising out of or relating to these
                Terms or the Platform shall be subject to the exclusive
                jurisdiction of the courts located in India.
              </p>
              <p className="leading-relaxed mt-3 text-gray-400">
                Before initiating any formal legal proceedings, the parties agree
                to first attempt to resolve any dispute through good-faith
                negotiation for a period of at least 30 days following written
                notice of the dispute.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                13. Modifications to Terms
              </h2>
              <p className="leading-relaxed">
                ThumbGen reserves the right to revise, update, or modify these
                Terms at any time at its sole discretion. When we make material
                changes, we will update the "Last updated" date at the top of
                this page. For significant changes, we will notify registered
                users via email or through a prominent notice on the Platform.
                Your continued use of the Platform after the effective date of
                any modifications constitutes your acceptance of the revised
                Terms. If you do not agree with the modified Terms, you should
                discontinue use of the Platform and delete your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                14. Contact Information
              </h2>
              <p className="leading-relaxed">
                If you have any questions, concerns, or feedback regarding these
                Terms and Conditions, please contact us at:
              </p>
              <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10 text-gray-400 space-y-1">
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
                  <strong className="text-gray-300">Website:</strong>{" "}
                  <a
                    href="https://thumbgen.online"
                    className="text-brand-400 hover:underline"
                  >
                    thumbgen.online
                  </a>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                15. Severability
              </h2>
              <p className="leading-relaxed">
                If any provision of these Terms is held to be invalid, illegal,
                or unenforceable by a court of competent jurisdiction, such
                provision shall be modified or severed to the minimum extent
                necessary, and the remaining provisions of these Terms shall
                continue in full force and effect.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                16. Entire Agreement
              </h2>
              <p className="leading-relaxed">
                These Terms, together with our{" "}
                <a href="/privacy" className="text-brand-400 hover:underline">
                  Privacy Policy
                </a>
                , constitute the entire agreement between you and ThumbGen
                regarding your use of the Platform and supersede all prior or
                contemporaneous communications, agreements, and understandings,
                whether written or oral, relating to the subject matter herein.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </>
  );
}
