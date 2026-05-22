import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PAオーダーシート",
  description: "PAオーダーシート提出フォーム",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
