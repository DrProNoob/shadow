export function ShadowMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 32 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 1 30 9 16 17 2 9 16 1Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m25.5 13.8 4.5 2.6-14 8-14-8 4.5-2.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m25.5 21.2 4.5 2.6-14 8-14-8 4.5-2.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function ShadowWordmark() {
  return (
    <div className="flex items-center gap-3" aria-label="SHADOW">
      <ShadowMark className="h-7 w-6" />
      <span className="text-[13px] font-medium tracking-[0.34em] text-white">
        SHADOW
      </span>
    </div>
  );
}
