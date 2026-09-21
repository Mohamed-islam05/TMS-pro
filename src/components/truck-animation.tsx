// ============================================================
// TruckAnimation - Animated truck scene for the Login page
// ============================================================
"use client";

interface TruckAnimationProps {
  driving?: boolean;
}

export function TruckAnimation({ driving = false }: TruckAnimationProps) {
  return (
    <div className="relative h-52 w-full overflow-hidden rounded-2xl shadow-lg sm:h-60">
      {/* Sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-500 via-sky-400 to-sky-300" />

      {/* Sun */}
      <div className="absolute right-10 top-6 h-14 w-14 rounded-full bg-yellow-300 shadow-[0_0_40px_10px_rgba(253,224,71,0.6)]" />

      {/* Clouds */}
      <div className="absolute left-8 top-8 flex gap-2 opacity-80">
        <div className="h-4 w-16 rounded-full bg-white/90" />
        <div className="h-5 w-10 -ml-2 rounded-full bg-white/90" />
      </div>
      <div className="absolute left-1/3 top-14 flex gap-2 opacity-60">
        <div className="h-3 w-10 rounded-full bg-white/80" />
        <div className="h-4 w-7 -ml-1 rounded-full bg-white/80" />
      </div>

      {/* Hills */}
      <div className="absolute bottom-16 left-0 h-16 w-1/3 rounded-tr-[100%] bg-emerald-500/80" />
      <div className="absolute bottom-16 right-0 h-20 w-1/2 rounded-tl-[100%] bg-emerald-600/70" />

      {/* Road */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-neutral-700 to-neutral-900">
        <div className="absolute inset-x-0 top-3 h-1.5 rounded bg-neutral-500" />
        <div className="absolute inset-x-0 top-9 h-1 bg-white/70 animate-road-scroll" />
        <div className="absolute inset-x-0 top-14 h-1.5 rounded bg-neutral-500" />
      </div>

      {/* Truck */}
      <div
        className={`absolute bottom-6 animate-truck-drive ${driving ? "truck-speed" : ""}`}
        style={{ width: "auto" }}
      >
        <svg viewBox="0 0 220 100" className="h-16 w-auto drop-shadow-lg sm:h-20">
          {/* Cargo container */}
          <rect x="10" y="14" width="120" height="58" rx="5" fill="#2563eb" />
          <rect x="10" y="14" width="120" height="14" rx="5" fill="#1d4ed8" />
          <rect x="30" y="40" width="80" height="4" rx="2" fill="#93c5fd" opacity="0.6" />
          <rect x="30" y="52" width="80" height="4" rx="2" fill="#93c5fd" opacity="0.6" />
          {/* Cab */}
          <path d="M132 72 L136 30 Q137 22 145 22 L176 22 Q196 22 202 38 L210 72 Z" fill="#1e3a8a" />
          <path d="M148 28 L152 64 L200 64 L196 46 Q190 34 178 30 Z" fill="#60a5fa" />
          <path d="M190 30 L200 46 L204 60 L196 60 L193 44 Z" fill="#bfdbfe" opacity="0.9" />
          <rect x="134" y="64" width="74" height="10" rx="2" fill="#172554" />
          {/* Chassis */}
          <rect x="10" y="70" width="200" height="8" rx="3" fill="#374151" />
          {/* Wheels */}
          <circle cx="55" cy="80" r="15" fill="#111827" stroke="#374151" strokeWidth="3" />
          <circle cx="55" cy="80" r="5" fill="#9ca3af" />
          <circle cx="115" cy="80" r="15" fill="#111827" stroke="#374151" strokeWidth="3" />
          <circle cx="115" cy="80" r="5" fill="#9ca3af" />
          <circle cx="185" cy="80" r="14" fill="#111827" stroke="#374151" strokeWidth="3" />
          <circle cx="185" cy="80" r="5" fill="#9ca3af" />
          {/* Headlight */}
          <circle cx="208" cy="62" r="4" fill="#fde047" />
        </svg>
      </div>
    </div>
  );
}
