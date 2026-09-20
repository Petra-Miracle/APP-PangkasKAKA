"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, Slot } from "@/lib/api";
import BookingStepper from "@/components/BookingStepper";

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function nextDays(n: number) {
  const out: { iso: string; label: string; day: number }[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({ iso: d.toISOString().slice(0, 10), label: DAY_LABELS[d.getDay()], day: d.getDate() });
  }
  return out;
}

export default function PilihJadwalTokoPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const barberId = search.get("barber") ?? "";
  const serviceId = search.get("service") ?? "";

  const days = useMemo(() => nextDays(7), []);
  const [date, setDate] = useState(days[0].iso);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!barberId || !serviceId) return;
    queueMicrotask(() => setLoading(true));
    api
      .shopSlots(shopId, barberId, date, serviceId)
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [shopId, barberId, date, serviceId]);

  function pick(time: string) {
    router.push(
      `/booking/toko/${shopId}/ringkasan?barber=${barberId}&service=${serviceId}&date=${date}&time=${time}`
    );
  }

  return (
    <main className="flex-1">
      <BookingStepper active={2} />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h2 className="text-sm font-semibold text-on-surface-2">Pilih Jadwal</h2>

        <p className="mt-4 text-xs font-semibold text-on-surface-3">Tanggal</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
          {days.map((d) => (
            <button
              key={d.iso}
              onClick={() => setDate(d.iso)}
              className={`flex w-14 shrink-0 flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs ${
                date === d.iso
                  ? "border-brand-primary bg-brand-primary text-on-brand-primary"
                  : "border-border text-on-surface-2"
              }`}
            >
              <span>{d.label}</span>
              <span className="text-sm font-bold">{d.day}</span>
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs font-semibold text-on-surface-3">Jam</p>
        {loading ? (
          <p className="mt-3 text-sm text-on-surface-3">Memuat slot...</p>
        ) : (
          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {slots.map((s) => (
              <button
                key={s.time}
                disabled={!s.available}
                onClick={() => pick(s.time)}
                className={`rounded-lg border py-2.5 text-sm font-semibold ${
                  !s.available
                    ? "cursor-not-allowed border-border text-on-surface-3 opacity-40"
                    : "border-border-strong text-on-surface hover:border-brand-primary hover:text-brand-secondary"
                }`}
              >
                {s.time}
              </button>
            ))}
            {slots.length === 0 && (
              <p className="col-span-full text-sm text-on-surface-3">
                Tidak ada slot tersedia untuk tanggal ini.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
