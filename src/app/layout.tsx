import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Netcab HR & KPI",
  description: "Quản lý giao việc, KPI, đánh giá và nhắc việc nội bộ Netcab",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
