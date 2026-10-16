import { ImageResponse } from "next/og";
import { theme } from "@/config/theme";

// Home-screen icon for iPhone/iPad (square; iOS rounds the corners).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: theme.brand,
          color: "white",
          fontSize: 80,
          fontWeight: 800,
          letterSpacing: -3,
        }}
      >
        MD
      </div>
    ),
    size,
  );
}
