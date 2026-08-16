import { PrivyClient } from "@privy-io/node";
import { clientEnv, serverEnv } from "@/lib/env";

export function getPrivyClient(): PrivyClient {
  return new PrivyClient({
    appId: clientEnv.NEXT_PUBLIC_PRIVY_APP_ID,
    appSecret: serverEnv.PRIVY_APP_SECRET,
  });
}
