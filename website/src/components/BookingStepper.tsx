const STEPS = ["Pilih Layanan", "Pilih Jadwal", "Ringkasan", "Pembayaran"];

export default function BookingStepper({ active }: { active: number }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-6 py-5 md:px-20">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const state = step === active ? "active" : step < active ? "done" : "todo";
        return (
          <div key={label} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  state === "active"
                    ? "bg-brand-primary text-on-brand-primary"
                    : state === "done"
                      ? "bg-brand-secondary text-surface"
                      : "bg-surface-3 text-on-surface-3"
                }`}
              >
                {step}
              </span>
              <span
                className={`hidden text-xs font-semibold sm:inline ${
                  state === "todo" ? "text-on-surface-3" : "text-on-surface"
                }`}
              >
                {label}
              </span>
            </div>
            {step < STEPS.length && <span className="h-px w-6 bg-border sm:w-10" />}
          </div>
        );
      })}
    </div>
  );
}
