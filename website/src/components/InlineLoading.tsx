import { Spinner } from "@heroui/react";

// Untuk pemuatan data biasa (listing, detail, riwayat) — beda dengan LoadingScreen
// (overlay besar full-screen) yang sengaja disimpan hanya untuk proses penting
// seperti pembuatan booking, supaya halaman biasa tidak terasa "macet total" saat
// memuat. role="status" + teks tersembunyi supaya screen reader tetap tahu ada
// proses loading, bukan cuma indikator visual.
export default function InlineLoading({ message = "Memuat..." }: { message?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-on-surface-3">
      <Spinner size="lg" color="current" className="text-brand" />
      <span>{message}</span>
    </div>
  );
}
