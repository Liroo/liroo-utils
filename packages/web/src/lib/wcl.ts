import "server-only";
import { WCLClient } from "@liroo/wlogs/client";

export function getWCLClientFromHeaders(headers: Headers): WCLClient {
  const clientId = headers.get("x-wcl-client-id");
  const clientSecret = headers.get("x-wcl-client-secret");
  if (!clientId || !clientSecret) {
    throw new Error("Missing WCL credentials. Please configure your Client ID and Secret.");
  }
  return new WCLClient(clientId, clientSecret);
}
