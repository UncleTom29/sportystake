import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content Security Policy. Tuned for a Next.js + wagmi + WalletConnect app.
 *  - 'unsafe-inline' on style-src is required by Tailwind's runtime + Next's
 *    framework styles. Removing it requires CSP nonces on every <style>.
 *  - 'unsafe-eval' is required by wagmi/viem's BigInt polyfill paths in
 *    older browsers; safe to drop once we set a minimum browser baseline.
 *  - https://*.api-sports.io is whitelisted for fixture/league/team logos.
 */
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' ${isProd ? "" : "'unsafe-eval'"} https://verify.walletconnect.com https://verify.walletconnect.org`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `img-src 'self' data: blob: https: https://media.api-sports.io https://media-1.api-sports.io https://media-2.api-sports.io https://media-3.api-sports.io https://media-4.api-sports.io https://walletconnect.org https://*.walletconnect.com`,
  `font-src 'self' https://fonts.gstatic.com data:`,
  `connect-src 'self' https: wss: https://*.api-sports.io https://*.privy.io https://auth.privy.io wss://*.privy.io https://*.walletconnect.com wss://*.walletconnect.com wss://*.walletconnect.org https://api.anthropic.com`,
  `frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org https://auth.privy.io https://*.privy.io`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compress: true,

  // Wagmi ships CJS bundles that benefit from transpilation.
  transpilePackages: [
    "wagmi",
    "@uncletom29/sportystake-sdk",
  ],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "media-1.api-sports.io" },
      { protocol: "https", hostname: "media-2.api-sports.io" },
      { protocol: "https", hostname: "media-3.api-sports.io" },
      { protocol: "https", hostname: "media-4.api-sports.io" },
    ],
  },

  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },

  serverExternalPackages: ["ioredis", "@prisma/client"],
};

export default nextConfig;
