import { MenuIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";

export default function Navbar() {
  const { isLoggedIn, user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleProtectedClick = (path: string) => {
    if (!isLoggedIn) {
      navigate("/login");
    } else {
      navigate(path);
    }
  };

  const handleLogoClick = () => {
    navigate("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navLinkClass = (active: boolean) =>
    `text-sm font-medium transition-colors duration-150 ${
      active ? "text-zinc-100" : "text-zinc-400 hover:text-zinc-100"
    }`;

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 h-16 border-b border-white/[0.08] bg-[#090a0c]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex items-center gap-2.5 focus:outline-none"
          >
            <img src={logo} alt="ThumbGen" className="h-9 w-auto" />
          </button>

          <nav className="hidden md:flex items-center gap-7" aria-label="Main">
            <Link to="/" className={navLinkClass(pathname === "/")}>
              Home
            </Link>
            <button
              type="button"
              onClick={() => handleProtectedClick("/generate")}
              className={navLinkClass(pathname.startsWith("/generate"))}
            >
              Studio
            </button>
            <button
              type="button"
              onClick={() => handleProtectedClick("/my-generation")}
              className={navLinkClass(pathname === "/my-generation")}
            >
              Gallery
            </button>
            <button
              type="button"
              onClick={() => {
                navigate("/");
                setTimeout(() => {
                  document
                    .getElementById("pricing")
                    ?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors duration-150"
            >
              Pricing
            </button>
            <Link
              to="/market-comparison"
              className={navLinkClass(pathname === "/market-comparison")}
            >
              Compare
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                {user && (
                  <button
                    type="button"
                    onClick={() => navigate("/profile")}
                    className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111317] border border-white/[0.08] hover:border-white/[0.16] text-xs font-medium text-zinc-300 tabular-nums"
                  >
                    <span className="size-1.5 rounded-full bg-brand-400" />
                    <span>{user.credits} cr</span>
                  </button>
                )}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => navigate("/profile")}
                    aria-label="Account menu"
                    className="rounded-lg size-9 bg-[#171a20] border border-white/[0.12] hover:border-white/[0.24] text-sm font-semibold text-zinc-100 flex items-center justify-center"
                  >
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </button>
                  <div className="absolute hidden group-hover:block top-9 right-0 pt-2 min-w-40">
                    <div className="bg-[#111317] border border-white/[0.1] rounded-xl p-1.5 shadow-xl">
                      <Link
                        to="/profile"
                        className="block px-3 py-2 text-xs font-medium text-zinc-200 rounded-lg hover:bg-white/[0.06]"
                      >
                        Account & Credits
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          navigate("/");
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 rounded-lg hover:bg-white/[0.06]"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="px-3.5 py-2 text-xs font-medium text-zinc-300 hover:text-white rounded-lg"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="px-4 py-2 text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white rounded-lg"
                >
                  Open Studio
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden size-10 flex items-center justify-center rounded-lg border border-white/[0.08] bg-[#111317] text-zinc-200"
            >
              <MenuIcon size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-[#090a0c] flex flex-col justify-between p-6 md:hidden">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <img src={logo} alt="ThumbGen" className="h-8 w-auto" />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close navigation menu"
              className="size-10 flex items-center justify-center rounded-lg border border-white/[0.1] bg-[#111317] text-zinc-200"
            >
              <XIcon size={20} />
            </button>
          </div>

          <nav className="flex flex-col gap-2 py-8 text-base font-medium text-zinc-200">
            <Link
              onClick={() => setIsOpen(false)}
              to="/"
              className="px-4 py-3 rounded-lg hover:bg-white/[0.04]"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                handleProtectedClick("/generate");
              }}
              className="text-left px-4 py-3 rounded-lg hover:bg-white/[0.04]"
            >
              Studio
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                handleProtectedClick("/my-generation");
              }}
              className="text-left px-4 py-3 rounded-lg hover:bg-white/[0.04]"
            >
              Gallery
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/");
                setTimeout(() => {
                  document
                    .getElementById("pricing")
                    ?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="text-left px-4 py-3 rounded-lg hover:bg-white/[0.04]"
            >
              Pricing
            </button>
            <Link
              onClick={() => setIsOpen(false)}
              to="/market-comparison"
              className="px-4 py-3 rounded-lg hover:bg-white/[0.04]"
            >
              Compare
            </Link>
            {isLoggedIn ? (
              <>
                <Link
                  onClick={() => setIsOpen(false)}
                  to="/profile"
                  className="px-4 py-3 rounded-lg hover:bg-white/[0.04]"
                >
                  Account ({user?.credits ?? 0} credits)
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    logout();
                    navigate("/");
                  }}
                  className="text-left px-4 py-3 rounded-lg text-red-400 hover:bg-white/[0.04]"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                onClick={() => setIsOpen(false)}
                to="/login"
                className="mt-4 text-center py-3 rounded-lg bg-zinc-100 text-zinc-950 font-semibold"
              >
                Sign in / Get Started
              </Link>
            )}
          </nav>

          <p className="text-xs text-zinc-500 text-center">
            &copy; {new Date().getFullYear()} ThumbGen
          </p>
        </div>
      )}
    </>
  );
}
