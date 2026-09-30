import { useEffect, useState } from 'react';
import { DashboardLiveChat } from './DashboardLiveChat';

type AppDataRouter = typeof import('../routes').router;

/** Full-page chat already covers this route — avoid stacking two UIs. */
const HIDE_ON = new Set(['/support']);

/**
 * Renders the floating "Chat with us" sheet on every app route.
 * Lives beside RouterProvider and subscribes to the data router for path changes.
 */
export function GlobalLiveChatHost({ router }: { router: AppDataRouter }) {
  const [pathname, setPathname] = useState(() => router.state.location.pathname);

  useEffect(() => {
    return router.subscribe((state) => {
      setPathname(state.location.pathname);
    });
  }, [router]);

  if (HIDE_ON.has(pathname)) return null;
  return <DashboardLiveChat />;
}
