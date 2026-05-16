import { verifyMessage, isAddress } from "viem";
import type { Address } from "@/lib/types";

export interface SiweFields {
  domain: string;
  address: Address;
  statement?: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}

/**
 * Minimal SIWE parser. Expects standard EIP-4361 format.
 */
export function parseSiweMessage(message: string): SiweFields {
  const lines = message.split("\n");
  if (lines.length < 6) throw new Error("SIWE: too few lines");

  const firstLine = lines[0];
  const domainMatch = firstLine.match(/^(.+?) wants you to sign in with your Ethereum account:$/);
  if (!domainMatch) throw new Error("SIWE: invalid first line");
  const domain = domainMatch[1].trim();

  const address = lines[1].trim();
  if (!isAddress(address)) throw new Error("SIWE: invalid address");

  // Optional statement on line 2 (index 2), blank line follows, then key/value lines.
  let cursor = 2;
  let statement: string | undefined;
  if (lines[cursor] !== "") {
    statement = lines[cursor];
    cursor++;
  }
  // skip blank
  if (lines[cursor] === "") cursor++;

  const fields: Record<string, string> = {};
  const resources: string[] = [];
  for (; cursor < lines.length; cursor++) {
    const line = lines[cursor];
    if (!line) continue;
    if (line.startsWith("- ")) {
      resources.push(line.slice(2));
      continue;
    }
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    fields[key] = value;
  }

  const uri = fields["URI"];
  const version = fields["Version"];
  const chainId = Number(fields["Chain ID"]);
  const nonce = fields["Nonce"];
  const issuedAt = fields["Issued At"];
  if (!uri || !version || !chainId || !nonce || !issuedAt) {
    throw new Error("SIWE: missing required field");
  }

  return {
    domain,
    address: address as Address,
    statement,
    uri,
    version,
    chainId,
    nonce,
    issuedAt,
    expirationTime: fields["Expiration Time"],
    notBefore: fields["Not Before"],
    requestId: fields["Request ID"],
    resources: resources.length ? resources : undefined,
  };
}

export async function verifySiwe(
  message: string,
  signature: `0x${string}`,
  expectedNonce?: string
): Promise<SiweFields> {
  const parsed = parseSiweMessage(message);
  if (expectedNonce && parsed.nonce !== expectedNonce) {
    throw new Error("SIWE: nonce mismatch");
  }
  if (parsed.expirationTime) {
    const exp = new Date(parsed.expirationTime).getTime();
    if (Number.isFinite(exp) && exp < Date.now()) throw new Error("SIWE: expired");
  }
  const ok = await verifyMessage({
    address: parsed.address,
    message,
    signature,
  });
  if (!ok) throw new Error("SIWE: invalid signature");
  return parsed;
}
