import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from './i18n/i18n';
import { LanguageProvider } from './i18n/LanguageProvider';
import {CatalogueConfiguration}from './components/CatalogueConfiguration';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";
import { AiCursorProvider } from "./contexts/AiCursorContext";
import { AiCursorOverlay } from "./components/AiCursorOverlay";
import { GlobalLiveChatHost } from "./components/GlobalLiveChatHost";
import { PageLoadingFallback } from "./components/PageLoadingFallback";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isSupabaseConfigured } from "./lib/supabaseClient";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const isProdBuild = import.meta.env.PROD;

/** Production builds must not silently run on demo data when env is missing. */
function ProductionConfigError() {
  useCerigaTranslation();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#09090B] px-5 text-white">
      <div className="max-w-md rounded-2xl border border-[#252528] bg-white/5 p-6 text-center">
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-extrabold">{cerigaTranslate("interface.text_0a48c29a3392f4ac")}</h1>
        <p className="mt-2 text-sm text-white/55">{cerigaTranslate("interface.text_b19011e56d74f174")}</p>
      </div>
    </div>
  );
}

function App() {
  const inner = (
    <AiCursorProvider>
      <Suspense fallback={<PageLoadingFallback />}>
        <RouterProvider router={router} />
      </Suspense>
      <GlobalLiveChatHost router={router} />
      <AiCursorOverlay />
      <Toaster />
    </AiCursorProvider>
  );
  if (isProdBuild && !isSupabaseConfigured) {
    return <ProductionConfigError />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider><CurrencyProvider><CatalogueConfiguration><NotificationsProvider>
          {googleClientId.trim() ? (
            <GoogleOAuthProvider clientId={googleClientId.trim()}>{inner}</GoogleOAuthProvider>
          ) : (
            inner
          )}
        </NotificationsProvider></CatalogueConfiguration></CurrencyProvider></LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
