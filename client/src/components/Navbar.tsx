import { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import RwdMark from "./RwdMark";

const navItems = [
  { to: "/", label: "Home", end: true },
  { to: "/services", label: "Services" },
  { to: "/work", label: "Work" },
  { to: "/pricing", label: "Pricing" },
  { to: "/arcade", label: "Arcade" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const close = () => setOpen(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="fixed top-0 inset-x-0 z-40 border-b border-white/5 bg-ink/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-5 sm:py-4">
        <Link to="/" onClick={close} className="group flex items-center gap-2 sm:gap-3">
          <RwdMark size={56} />
          <span
            data-text="REBEL WEB DESIGNS"
            className="glitch font-display text-sm font-bold tracking-wide text-silver sm:text-lg"
          >
            REBEL WEB DESIGNS
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-7 text-sm text-ash md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `transition hover:text-silver ${isActive ? "text-silver" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/pricing"
            onClick={close}
            className="btn-silver sheen hidden rounded-sm px-4 py-2 text-sm font-semibold sm:inline-block"
          >
            Start a project
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={open}
            className="flex h-10 w-10 items-center justify-center rounded-sm border border-silver/30 text-silver md:hidden"
          >
            <span className="text-lg leading-none">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      {open && (
        <div className="border-t border-white/10 bg-ink/95 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={close}
                className={({ isActive }) =>
                  `rounded-sm px-3 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? "bg-silver/10 text-silver"
                      : "text-ash hover:bg-white/5 hover:text-silver"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link
              to="/pricing"
              onClick={close}
              className="btn-silver sheen mt-2 rounded-sm px-4 py-2.5 text-center text-sm font-semibold"
            >
              Start a project
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
