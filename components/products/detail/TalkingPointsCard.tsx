'use client';

interface TalkingPointsCardProps {
  points: string[];
}

export default function TalkingPointsCard({ points }: TalkingPointsCardProps) {
  if (!points || points.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wide mb-3">Talking Points</h3>
      <ul className="space-y-2">
        {points.map((point, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-amber-900">
            <span className="text-amber-500 mt-0.5 flex-shrink-0">&#x2022;</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
