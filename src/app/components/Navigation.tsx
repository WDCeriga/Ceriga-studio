import { Link, useLocation } from "react-router";
import { Button } from "./ui/button";

export function Navigation() {
  const location = useLocation();

  return (
    <nav className="border-b border-white/10 bg-[#0F0F0F]">
      <div className="max-w-[1920px] mx-auto px-8 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="text-white font-['Plus_Jakarta_Sans',sans-serif] font-extrabold text-[18px] tracking-[0.5px] uppercase">
            CERIGA STUDIO
          </div>
        </Link>

        <div className="flex items-center gap-8">
          <a
            href="#features"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            FEATURES
          </a>
          <a
            href="#how-it-works"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            HOW IT WORKS
          </a>
          <a
            href="#pricing"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            PRICING
          </a>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/5"
            >
              LOG IN
            </Button>
          </Link>
          <Link to="/signup">
            <Button
              size="sm"
              className="bg-[#CC2D24] hover:bg-[#CC2D24]/90 text-white font-semibold px-6"
            >
              LAUNCH STUDIO
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
