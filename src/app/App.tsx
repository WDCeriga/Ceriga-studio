import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";
import { PageLoadingFallback } from "./components/PageLoadingFallback";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

function App() {
  const inner = (
    <>
      <Suspense fallback={<PageLoadingFallback />}>
        <RouterProvider router={router} />
      </Suspense>
      <Toaster />
    </>
  );
  return (
    <AuthProvider>
      <NotificationsProvider>
        {googleClientId.trim() ? (
          <GoogleOAuthProvider clientId={googleClientId.trim()}>{inner}</GoogleOAuthProvider>
        ) : (
          inner
        )}
      </NotificationsProvider>
    </AuthProvider>
  );
}

export default App;