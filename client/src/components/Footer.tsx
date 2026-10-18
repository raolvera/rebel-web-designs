import { Link } from "react-router-dom";
import RwdMark from "./RwdMark";

export default function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-5 pb-12 pt-8">
      <div className="flex flex-col items-center justify-between gap-6 border-t border-white/5 pt-8 sm:flex-row">
        <Link to="/" className="flex items-center gap-3">
          <RwdMark size={64} />
          <span
            data-text="REBEL WEB DESIGNS"
            className="glitch font-display text-sm font-bold tracking-wide text-silver"
          >
            REBEL WEB DESIGNS
          </span>
        </Link>

        <nav className="flex flex-wrap gap-5 text-sm text-ash">
          <Link to="/services" className="transition hover:text-silver">Services</Link>
          <Link to="/work" className="transition hover:text-silver">Work</Link>
          <Link to="/pricing" className="transition hover:text-silver">Pricing</Link>
          <Link to="/arcade" className="transition hover:text-silver">Arcade</Link>
          <Link to="/contact" className="transition hover:text-silver">Contact</Link>
        </nav>

        <div className="flex items-center gap-4 text-sm">
          <a
            href="https://github.com/raolvera"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ash transition hover:text-silver"
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/rey-olvera/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ash transition hover:text-silver"
          >
            LinkedIn
          </a>
          <a
            href="https://reyolvera.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ash transition hover:text-silver"
          >
            Portfolio
          </a>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-ash sm:text-right">
        © {new Date().getFullYear()} Rebel Web Designs
      </p>
    </footer>
  );
}
