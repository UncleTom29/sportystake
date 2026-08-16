import { ImageResponse } from "next/og";

export const alt = "SportyStake — Non-Custodial Web3 Sportsbook & Casino";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Previously the site linked to a static /og-banner.jpg that was never
// actually added to public/ — every shared link (site pages and code/ticket
// links alike, since none override openGraph.images) rendered no preview
// image at all. This generates a real one at build time instead.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b141b",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -100,
            width: 700,
            height: 700,
            borderRadius: "50%",
            background: "#00e701",
            opacity: 0.12,
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 88,
              height: 88,
              borderRadius: 20,
              background: "#00e701",
              fontSize: 52,
              fontWeight: 800,
              color: "#0b141b",
            }}
          >
            S
          </div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, letterSpacing: -2 }}>
            <span style={{ color: "#ffffff" }}>sporty</span>
            <span style={{ color: "#00e701" }}>stake</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 30,
            color: "#b1bad3",
            textAlign: "center",
          }}
        >
          Non-Custodial Crypto Sportsbook &amp; On-Chain Casino
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 36,
            gap: 16,
          }}
        >
          {["Zero KYC", "Provably Fair", "Instant Settlement"].map((tag) => (
            <div
              key={tag}
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 999,
                background: "#1a2c38",
                color: "#d6e2ed",
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
