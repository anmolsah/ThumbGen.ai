import { footerData } from "../data/footer";
import type { IFooterLink } from "../types";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

export default function Footer() {
  const navigate = useNavigate();

  const handleFooterLink = (href: string) => {
    if (href.includes("#")) {
      const [path, hash] = href.split("#");
      navigate(path || "/");
      setTimeout(() => {
        document
          .getElementById(hash)
          ?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      navigate(href);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <footer className="mt-24 border-t border-white/[0.08] bg-[#090a0c] py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between gap-12">
          <div className="space-y-3 max-w-xs">
            <button
              type="button"
              onClick={() => handleFooterLink("/")}
              className="flex items-center gap-2"
            >
              <img className="h-8 w-auto" src={logo} alt="ThumbGen" />
            </button>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Multi-aspect-ratio thumbnail generation in 2K and true 4K. Pay once per credit pack, with automatic credit refunds on any failed job.
            </p>
          </div>

          <div className="flex flex-wrap gap-12 sm:gap-16">
            {footerData.map((section, index) => (
              <div key={index}>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  {section.title}
                </p>
                <ul className="mt-3 space-y-2.5 text-xs text-zinc-400">
                  {section.links.map((link: IFooterLink, idx: number) => (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() => handleFooterLink(link.href)}
                        className="hover:text-zinc-100 transition-colors"
                      >
                        {link.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>&copy; {new Date().getFullYear()} ThumbGen. All rights reserved.</p>
          <p className="tabular-nums">Output verified: 2K (2048–2816px) &amp; True 4K (3840–5504px)</p>
        </div>
      </div>
    </footer>
  );
}
