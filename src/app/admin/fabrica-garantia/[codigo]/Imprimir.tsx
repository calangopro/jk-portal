"use client";

import { Printer } from "lucide-react";

export function Imprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#1a1815] px-4 text-sm font-semibold text-white">
      <Printer size={15} aria-hidden="true" /> Imprimir
    </button>
  );
}
