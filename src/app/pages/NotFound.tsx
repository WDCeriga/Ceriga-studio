import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../i18n/i18n';
import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Home } from "lucide-react";

export function NotFound() {
  useCerigaTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-white px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-7xl font-bold text-gray-200 sm:text-9xl">404</h1>
        <h2 className="text-3xl font-bold mb-4">{cerigaTranslate("interface.text_a469ab4ca4e55bf5")}</h2>
        <p className="text-gray-600 mb-8">{cerigaTranslate("interface.text_f2882177bbff3759")}</p>
        <Button asChild className="bg-[#534AB7] hover:bg-[#534AB7]/90">
          <Link to="/">
            <Home className="w-4 h-4 mr-2" />{cerigaTranslate("interface.text_eec78426776352f1")}</Link>
        </Button>
      </div>
    </div>
  );
}
