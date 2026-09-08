import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";
import { PageLoadingFallback } from "./components/PageLoadingFallback";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isSupabaseConfigured } from "./lib/supabaseClient";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const isProdBuild = import.meta.env.PROD;

/** Production builds must not silently run on demo data when env is missing. */
function ProductionConfigError() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#09090B] px-5 text-white">
      <div className="max-w-md rounded-2xl border border-[#252528] bg-white/5 p-6 text-center">
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-extrabold">
          Configuration error
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Database environment variables are missing in this deployment. Set
          VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or the NEXT_PUBLIC_ equivalents)
          and redeploy.
        </p>
      </div>
    </div>
  );
}

function App() {
  const inner = (
    <>
      <Suspense fallback={<PageLoadingFallback />}>
        <RouterProvider router={router} />
      </Suspense>
      <Toaster />
    </>
  );
  if (isProdBuild && !isSupabaseConfigured) {
    return <ProductionConfigError />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationsProvider>
          {googleClientId.trim() ? (
            <GoogleOAuthProvider clientId={googleClientId.trim()}>{inner}</GoogleOAuthProvider>
          ) : (
            inner
          )}
        </NotificationsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;