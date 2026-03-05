'use client';

import { useState } from 'react';

interface TalkingPointsCardProps {
  points: string[];
  headerAction?: React.ReactNode;
}

export default function TalkingPointsCard({ points, headerAction }: TalkingPointsCardProps) {
  const [open, setOpen] = useState(true);

  if (!points || points.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 cursor-pointer"
      >
        <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wide">Talking Points</h3>
        <div className="flex items-center gap-2">
          {headerAction && (
            <span onClick={(e) => e.stopPropagation()}>
              {headerAction}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-amber-600 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <ul className="space-y-2 px-5 pb-4">
          {points.map((point, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-amber-900">
              <span className="text-amber-500 mt-0.5 flex-shrink-0">&#x2022;</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
