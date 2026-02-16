import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PReview - PR Intelligence Dashboard",
  description:
    "AI-powered PR and Issue intelligence platform for open-source maintainers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
