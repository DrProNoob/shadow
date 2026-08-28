import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";

export function RealityPageFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <header className="flex flex-col gap-5 border-b border-[var(--border)] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-2xl font-medium tracking-[-0.035em] text-white sm:text-3xl">
            {title}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
            {description}
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
          <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
          Fictional demo data
        </div>
      </header>

      <div className="pt-7">{children}</div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
        {label}
      </p>
      <p className="mt-3 truncate text-xl font-medium tracking-[-0.025em] text-white sm:text-2xl">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
        {detail}
      </p>
    </div>
  );
}

export function SectionHeading({
  id,
  title,
  description,
}: {
  id?: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 id={id} className="text-sm font-medium text-white">
        {title}
      </h2>
      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
        {description}
      </p>
    </div>
  );
}
