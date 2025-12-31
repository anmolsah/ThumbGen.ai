import { footerData } from "../data/footer";
import { motion } from "motion/react";
import type { IFooterLink } from "../types";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";

export default function Footer() {
  return (
    <footer className="mt-20 sm:mt-32 md:mt-40 py-8 sm:py-10 px-4 sm:px-6 md:px-16 lg:px-24 xl:px-32 text-[13px] text-gray-500 border-t border-white/10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between gap-10 lg:gap-20">
          {/* Left Section - Logo and Links */}
          <motion.div
            className="flex flex-col sm:flex-row flex-wrap items-center sm:items-start gap-8 sm:gap-10 md:gap-16 lg:gap-20"
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{
              type: "spring",
              stiffness: 280,
              damping: 70,
              mass: 1,
            }}
          >
            <Link to="/" className="flex-shrink-0">
              <img className="w-auto h-7 sm:h-8" src={logo} alt="footer logo" />
            </Link>
            <div className="flex flex-wrap justify-center sm:justify-start gap-8 sm:gap-10 md:gap-16">
              {footerData.map((section, index) => (
                <div key={index} className="text-center sm:text-left">
                  <p className="text-slate-100 font-semibold text-sm">
                    {section.title}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {section.links.map((link: IFooterLink, idx: number) => (
                      <li key={idx}>
                        <Link
                          to={link.href}
                          className="hover:text-brand-400 transition"
                        >
                          {link.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right Section - Description and Copyright */}
          <motion.div
            className="flex flex-col items-center lg:items-end text-center lg:text-right gap-3"
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{
              type: "spring",
              stiffness: 280,
              damping: 70,
              mass: 1,
              delay: 0.1,
            }}
          >
            <p className="max-w-60 text-sm">
              Generate stunning AI thumbnails that get clicks and boost your
              content.
            </p>
            <p className="mt-2 text-xs sm:text-sm">
              &copy; {new Date().getFullYear()} ThumbGen. All rights reserved.
            </p>
          </motion.div>
        </div>
      </div>
    </footer>
  );
}
