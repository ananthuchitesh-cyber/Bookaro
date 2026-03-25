import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bookaro | AI Travel Planner for India",
  description:
    "Plan your India trip with Bookaro AI. Compare transport, stays, food, itineraries, and budget insights in a polished travel planning experience.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-inter antialiased bg-gray-950">{children}</body>
    </html>
  );
}
