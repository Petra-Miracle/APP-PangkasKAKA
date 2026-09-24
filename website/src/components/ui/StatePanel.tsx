import { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import Button from "./Button";

type StatePanelProps = {
  icon?: ReactNode;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
};

/** Panel empty-state netral — hasil kosong, belum ada data, dsb. */
export function EmptyState({ icon, title, description, actionLabel, onAction, actionHref, className = "" }: StatePanelProps) {
  return (
    <div role="status" className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-2 px-6 py-14 text-center ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 text-on-surface-3">
        {icon ?? <Inbox size={20} aria-hidden="true" />}
      </div>
      <p className="text-sm font-bold text-on-surface">{title}</p>
      {description && <p className="max-w-sm text-sm text-on-surface-3">{description}</p>}
      {actionLabel && (actionHref ? (
        <Button href={actionHref} variant="outline" size="sm" className="mt-1">
          {actionLabel}
        </Button>
      ) : (
        <Button onClick={onAction} variant="outline" size="sm" className="mt-1">
          {actionLabel}
        </Button>
      ))}
    </div>
  );
}

/** Panel error — kegagalan API/jaringan, selalu sediakan tombol "Coba lagi". */
export function ErrorState({ title = "Gagal memuat data", description, actionLabel = "Coba lagi", onAction, actionHref, className = "" }: StatePanelProps) {
  return (
    <div role="alert" className={`flex flex-col items-center gap-3 rounded-2xl border border-error/25 bg-error/5 px-6 py-14 text-center ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
        <AlertTriangle size={20} aria-hidden="true" />
      </div>
      <p className="text-sm font-bold text-on-surface">{title}</p>
      {description && <p className="max-w-sm text-sm text-on-surface-3">{description}</p>}
      {actionHref ? (
        <Button href={actionHref} variant="outline" size="sm" className="mt-1">
          {actionLabel}
        </Button>
      ) : (
        <Button onClick={onAction} variant="outline" size="sm" className="mt-1">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
