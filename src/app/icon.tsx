import { ImageResponse } from "next/og";
import { theme } from "@/config/theme";

// Browser-tab icon: the purple "MD" tile from the app's top bar.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 14,
          color: "white",
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: -1,
        }}
      >
        MD
      </div>
    ),
    size,
  );
}
