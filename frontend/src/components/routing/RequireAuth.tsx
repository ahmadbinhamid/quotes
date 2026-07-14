import type { ReactNode } from "react";
import { getAuthToken } from "@/lib/auth-token";
import NotFoundPage from "@/pages/public/NotFoundPage";

// Gates the staff-facing routes: adoptTokenFromQuery() runs synchronously in
// main.tsx before the app ever renders, so by the time this evaluates,
// getAuthToken() already reflects whether a session token was delivered
// (embedded in the tenant dashboard) or not (e.g. someone stripping a share
// link down to the bare domain). Only checks presence, not validity — an
// expired/invalid token still renders the page, and its API calls fail with
// their own 401 handling; this only blocks the fully-anonymous case.
export function RequireAuth({ children }: { children: ReactNode }) {
  return getAuthToken() ? <>{children}</> : <NotFoundPage />;
}
