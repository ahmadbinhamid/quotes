import { useEffect } from "react";
import { useFlowposApp } from "@flowposltd/apps-sdk/app";
import { setAuthToken } from "@/lib/auth-token";

/**
 * Wires this app up to the tenant-dashboard iframe host via @flowposltd/
 * apps-sdk: theme sync and auto-resize. NOTE: despite apps-sdk's own docs
 * describing a postMessage auth handshake, the tenant dashboard's actual
 * embedding code (EmbedApp.tsx) never sends one — the real token delivery is
 * the `?token=` query string handled in src/main.tsx / src/lib/auth-token.ts.
 * So this only *adds* a token if apps-sdk ever does receive one (future-
 * proofing for when the host adopts postMessage delivery) — it must never
 * clear a token that was already adopted from the query string.
 *
 * Origins allowed to complete the handshake — override via
 * VITE_FLOWPOS_DASHBOARD_ORIGINS (comma-separated) for staging/prod; defaults
 * cover local dashboard dev.
 */
const allowedParentOrigins = (
  import.meta.env.VITE_FLOWPOS_DASHBOARD_ORIGINS ??
  "http://localhost:5173,http://localhost:3000"
)
  .split(",")
  .map((origin: string) => origin.trim())
  .filter(Boolean);

export function useEmbed() {
  const flowpos = useFlowposApp({ allowedParentOrigins });

  useEffect(() => {
    if (flowpos.context?.authToken) {
      setAuthToken(flowpos.context.authToken);
    }
  }, [flowpos.context?.authToken]);

  return flowpos;
}
