"use client";

import { ArrowRight, FileCheck2, FlaskConical, History } from "lucide-react";
import type { ReceiptHistoryItemView } from "@/components/receipts/receipt-model";
import type { ReceiptId } from "@/domain/model";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

function formatMoney(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

function formatTimestamp(value: string): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? value
    : dateFormatter.format(timestamp);
}

export type ReceiptHistoryProps = {
  receipts: ReceiptHistoryItemView[];
  selectedReceiptId?: ReceiptId | null;
  onSelectReceipt: (receiptId: ReceiptId) => void;
};

export function ReceiptHistory({
  receipts,
  selectedReceiptId,
  onSelectReceipt,
}: ReceiptHistoryProps) {
  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <header className="flex flex-col gap-5 border-b border-[var(--border)] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Reality history
          </p>
          <h1 className="mt-3 text-2xl font-medium tracking-[-0.035em] text-white sm:text-3xl">
            Receipts
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            Deterministic records of the staged changes, structured proof, and
            calculated impact that became synthetic Reality.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
          Fictional demo history
        </span>
      </header>

      {receipts.length === 0 ? (
        <div className="mt-7 grid min-h-72 place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-6 text-center">
          <div>
            <History
              aria-hidden="true"
              className="mx-auto h-5 w-5 text-[var(--text-faint)]"
            />
            <h2 className="mt-4 text-sm font-medium text-white">
              No committed futures yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[var(--text-muted)]">
              A receipt appears after a human reviews and commits an eligible
              Shadow.
            </p>
          </div>
        </div>
      ) : (
        <section className="mt-7" aria-labelledby="receipt-history-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2
                id="receipt-history-title"
                className="text-sm font-medium text-white"
              >
                Committed Reality versions
              </h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Most recent receipt first.
              </p>
            </div>
            <span className="font-mono text-[10px] text-[var(--text-faint)]">
              {receipts.length} {receipts.length === 1 ? "receipt" : "receipts"}
            </span>
          </div>

          <div className="mt-4 hidden overflow-hidden rounded-xl border border-[var(--border)] md:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Committed SHADOW receipts</caption>
              <thead className="bg-[var(--surface-subtle)]">
                <tr className="border-b border-[var(--border)] text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                  <th scope="col" className="px-4 py-3">
                    Receipt
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Reality
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Changes
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Annual savings
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Committed
                  </th>
                  <th scope="col" className="w-12 px-4 py-3">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                {receipts.map((receipt) => (
                  <tr
                    key={receipt.receiptId}
                    className={
                      selectedReceiptId === receipt.receiptId
                        ? "bg-[color:var(--accent)]/5"
                        : ""
                    }
                  >
                    <th scope="row" className="px-4 py-4 font-normal">
                      <button
                        type="button"
                        onClick={() => onSelectReceipt(receipt.receiptId)}
                        className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      >
                        <span className="block text-xs font-medium text-white">
                          {receipt.shadowName}
                        </span>
                        <span className="mt-1 block font-mono text-[9px] text-[var(--text-faint)]">
                          {receipt.receiptId}
                        </span>
                      </button>
                    </th>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-2 font-mono text-xs text-[var(--text-secondary)]">
                        v{receipt.realityVersionBefore}
                        <ArrowRight
                          aria-hidden="true"
                          className="h-3 w-3 text-[var(--accent)]"
                        />
                        v{receipt.realityVersionAfter}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-xs text-white">
                      {receipt.changeCount}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-xs text-[var(--success)]">
                      {formatMoney(receipt.annualSavingsCents)}
                    </td>
                    <td className="px-4 py-4 text-right text-[10px] text-[var(--text-muted)]">
                      {formatTimestamp(receipt.committedAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectReceipt(receipt.receiptId)}
                        className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      >
                        <ArrowRight
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                        />
                        <span className="sr-only">
                          Open receipt for {receipt.shadowName}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-4 grid gap-3 md:hidden">
            {receipts.map((receipt) => (
              <li key={receipt.receiptId}>
                <button
                  type="button"
                  onClick={() => onSelectReceipt(receipt.receiptId)}
                  className={`w-full rounded-xl border bg-[var(--surface)] p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${selectedReceiptId === receipt.receiptId ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-medium text-white">
                        {receipt.shadowName}
                      </span>
                      <span className="mt-1 block font-mono text-[9px] text-[var(--text-faint)]">
                        {receipt.receiptId}
                      </span>
                    </span>
                    <FileCheck2
                      aria-hidden="true"
                      className="h-4 w-4 text-[var(--accent)]"
                    />
                  </span>
                  <span className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
                    <span>
                      <span className="block text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                        Reality
                      </span>
                      <span className="mt-1 block font-mono text-xs text-white">
                        v{receipt.realityVersionBefore} → v
                        {receipt.realityVersionAfter}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[9px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
                        Annual savings
                      </span>
                      <span className="mt-1 block font-mono text-xs text-[var(--success)]">
                        {formatMoney(receipt.annualSavingsCents)}
                      </span>
                    </span>
                  </span>
                  <span className="mt-3 block text-[10px] text-[var(--text-muted)]">
                    {formatTimestamp(receipt.committedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
