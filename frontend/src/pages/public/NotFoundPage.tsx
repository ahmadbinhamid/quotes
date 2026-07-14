// Shown for the staff-facing routes when there's no session token — e.g.
// someone strips a share link down to the bare domain. Deliberately generic:
// no app branding, no hint that a staff dashboard exists behind this URL.
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-content-secondary">
          The page you're looking for doesn't exist or isn't available here.
        </p>
      </div>
    </div>
  );
}
