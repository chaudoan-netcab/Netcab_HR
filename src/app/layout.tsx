import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Netcab HR & KPI",
  description: "Quản lý giao việc, KPI, đánh giá và nhắc việc nội bộ Netcab",
};

// Sáng / tối theo NETCAB: class .dark trên <html>, lưu localStorage "netcab-theme-mode" (light | dark | auto — mặc định theo máy).
// Chạy trong <head> trước khi vẽ trang nên không nháy màu. Khi in luôn dùng màu sáng.
const THEME_SCRIPT = `(function(){var KEY='netcab-theme-mode',mode='auto';try{mode=localStorage.getItem(KEY)||'auto'}catch(e){}
var mq=window.matchMedia('(prefers-color-scheme: dark)'),root=document.documentElement;
function apply(){root.classList.toggle('dark',mode==='dark'||(mode==='auto'&&mq.matches))}
apply();mq.addEventListener('change',function(){if(mode==='auto')apply()});
window.addEventListener('beforeprint',function(){root.classList.remove('dark')});window.addEventListener('afterprint',apply);
window.netcabSetTheme=function(m){mode=m;try{localStorage.setItem(KEY,m)}catch(e){}apply()};window.netcabApplyTheme=apply})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
