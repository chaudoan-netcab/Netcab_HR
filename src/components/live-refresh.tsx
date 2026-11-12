"use client";
// Thời gian thực:
// - AutoRefresh: tự lấy lại số liệu (router.refresh — không tải lại trang, không mất vị trí cuộn),
//   tạm dừng khi tab bị ẩn, lấy ngay khi quay lại tab. Không có giao diện.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onVis = () => {
      const v = document.visibilityState === "visible";
      setVisible(v);
      if (v) router.refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [router]);
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [visible, seconds, router]);
  return null;
}
