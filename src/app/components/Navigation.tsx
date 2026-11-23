import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../i18n/i18n';
import { Link, useLocation } from "react-router";
import { Button } from "./ui/button";

export function Navigation() {
  useCerigaTranslation();

  const location = useLocation();

  return (
    <nav className="border-b border-[#252528] bg-[#09090B]">
      <div className="max-w-[1920px] mx-auto px-8 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="text-white font-['Plus_Jakarta_Sans',sans-serif] font-extrabold text-[18px] tracking-[0.5px] uppercase">{cerigaTranslate("interface.text_561349849264579e")}</div>
        </Link>

        <div className="flex items-center gap-8">
          <a
            href="#features"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors"
          >{cerigaTranslate("interface.text_d88dd8363c93124a")}</a>
          <a
            href="#how-it-works"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors"
          >{cerigaTranslate("interface.text_6a4cc4c27d2fd291")}</a>
          <a
            href="#pricing"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors"
          >{cerigaTranslate("interface.text_c1f8db4b1c91223e")}</a>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/5"
            >{cerigaTranslate("interface.text_74f46cca78015206")}</Button>
          </Link>
          <Link to="/signup">
            <Button
              size="sm"
              className="bg-[#CC2D24] hover:bg-[#CC2D24]/90 text-white font-semibold px-6"
            >{cerigaTranslate("interface.text_813da2461cc7d32a")}</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
