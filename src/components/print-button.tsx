"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "In / Lưu PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn no-print">
      <Printer size={16} aria-hidden /> {label}
    </button>
  );
}
