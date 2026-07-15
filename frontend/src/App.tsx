import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@flowposltd/ui";
import { AppProviders } from "@/components/providers/app-providers";
import { RequireAuth } from "@/components/routing/RequireAuth";
import { useEmbed } from "@/app/use-embed";
import QuotesListPage from "@/pages/quotes/QuotesListPage";
import QuoteFormPage from "@/pages/quotes/QuoteFormPage";
import QuoteDetailPage from "@/pages/quotes/QuoteDetailPage";
import PublicQuotePage from "@/pages/public/PublicQuotePage";

export default function App() {
  // Handshake + theme sync + auto-resize with the tenant-dashboard iframe
  // host (no-op when run standalone, outside an iframe — which is exactly
  // how a customer opens a /q/:token share link).
  useEmbed();

  return (
    <BrowserRouter>
      <AppProviders>
        <Routes>
          {/* Customer-facing share link — no auth, opened directly outside
              the dashboard iframe. */}
          <Route path="/q/:token" element={<PublicQuotePage />} />

          {/* Staff-facing, embedded in the tenant dashboard — gated behind
              RequireAuth so an anonymous visitor (e.g. a stripped-down share
              link) gets a plain "not found" page instead of the dashboard
              shell. */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <QuotesListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/quotes/new"
            element={
              <RequireAuth>
                <QuoteFormPage />
              </RequireAuth>
            }
          />
          <Route
            path="/quotes/:id"
            element={
              <RequireAuth>
                <QuoteDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/quotes/:id/edit"
            element={
              <RequireAuth>
                <QuoteFormPage />
              </RequireAuth>
            }
          />
          <Route
            path="*"
            element={
              <RequireAuth>
                <QuotesListPage />
              </RequireAuth>
            }
          />
        </Routes>
      </AppProviders>
      <Toaster />
    </BrowserRouter>
  );
}
