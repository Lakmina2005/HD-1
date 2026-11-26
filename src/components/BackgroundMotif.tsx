import React from 'react';

export const BackgroundMotif: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      <svg
        className="absolute top-10 left-[8%] w-12 h-12 text-zinc-900/[0.035] -rotate-12"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>

      <svg
        className="absolute top-20 right-[10%] w-14 h-14 text-zinc-900/[0.035] rotate-12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="2" y="4" width="20" height="16" rx="4" />
        <polygon points="10 9 16 12 10 15 10 9" fill="currentColor" />
      </svg>

      <svg
        className="absolute top-64 left-[14%] w-11 h-11 text-zinc-900/[0.03] rotate-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12l4 4 4-4" />
      </svg>

      <svg
        className="absolute top-72 right-[15%] w-12 h-12 text-zinc-900/[0.03] -rotate-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </svg>

      <svg
        className="absolute bottom-24 left-[10%] w-12 h-12 text-zinc-900/[0.03] -rotate-12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>

      <svg
        className="absolute bottom-20 right-[11%] w-11 h-11 text-zinc-900/[0.03] rotate-12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </div>
  );
};
