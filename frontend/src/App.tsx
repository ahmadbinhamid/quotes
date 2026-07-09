import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AppProviders } from "@/components/providers/app-providers";
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

          {/* Staff-facing, embedded in the tenant dashboard. */}
          <Route path="/" element={<QuotesListPage />} />
          <Route path="/quotes/new" element={<QuoteFormPage />} />
          <Route path="/quotes/:id" element={<QuoteDetailPage />} />
          <Route path="/quotes/:id/edit" element={<QuoteFormPage />} />
          <Route path="*" element={<QuotesListPage />} />
        </Routes>
      </AppProviders>
      <Toaster richColors position="bottom-right" />
    </BrowserRouter>
  );
}
