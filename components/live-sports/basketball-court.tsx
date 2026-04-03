"use client"

interface BasketballCourtProps {
  ballPosition: { x: number; y: number }
  possession: "home" | "away"
  homeColor: string
  awayColor: string
}

export function BasketballCourt({ ballPosition, possession, homeColor, awayColor }: BasketballCourtProps) {
  const ballColor = possession === "home" ? homeColor : awayColor
  const bx = ballPosition.x
  const by = ballPosition.y * 0.56 + 2

  return (
    <svg viewBox="0 0 100 60" className="w-full rounded-xl overflow-hidden" style={{ background: "#0d1117" }}>
      {/* Court floor — Polymarket dark blue */}
      <rect x="2" y="2" width="96" height="56" rx="1.5" fill="#1a2332" />
      {/* Court subtle gradient overlay */}
      <defs>
        <radialGradient id="courtGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.06" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ballGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ballColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={ballColor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="96" height="56" rx="1.5" fill="url(#courtGlow)" />

      {/* Court boundary */}
      <rect x="2" y="2" width="96" height="56" rx="1.5" fill="none" stroke="#3b82f6" strokeWidth="0.4" strokeOpacity="0.5" />
      {/* Center line */}
      <line x1="50" y1="2" x2="50" y2="58" stroke="#3b82f6" strokeWidth="0.3" strokeOpacity="0.4" />
      {/* Center circle */}
      <circle cx="50" cy="30" r="6" fill="none" stroke="#3b82f6" strokeWidth="0.3" strokeOpacity="0.4" />

      {/* Polymarket logo at center court */}
      <g transform="translate(45.5, 25.5) scale(0.0195)" opacity="0.12">
        <path d="M375.84 389.422C375.84 403.572 375.84 410.647 371.212 414.154C366.585 417.662 359.773 415.75 346.15 411.927L127.22 350.493C119.012 348.19 114.907 347.038 112.534 343.907C110.161 340.776 110.161 336.513 110.161 327.988V184.012C110.161 175.487 110.161 171.224 112.534 168.093C114.907 164.962 119.012 163.81 127.22 161.507L346.15 100.072C359.773 96.2495 366.585 94.338 371.212 97.8455C375.84 101.353 375.84 108.428 375.84 122.578V389.422ZM164.761 330.463L346.035 381.337V279.595L164.761 330.463ZM139.963 306.862L321.201 256L139.963 205.138V306.862ZM164.759 181.537L346.035 232.406V130.663L164.759 181.537Z" fill="#3b82f6" />
      </g>

      {/* Left three-point arc */}
      <path d="M 2 16 Q 22 30 2 44" fill="none" stroke="#3b82f6" strokeWidth="0.3" strokeOpacity="0.4" />
      {/* Left key */}
      <rect x="2" y="18" width="16" height="24" fill="none" stroke="#3b82f6" strokeWidth="0.3" strokeOpacity="0.4" />
      {/* Left free-throw circle */}
      <circle cx="18" cy="30" r="6" fill="none" stroke="#3b82f6" strokeWidth="0.3" strokeOpacity="0.3" strokeDasharray="1 1" />
      {/* Left basket */}
      <rect x="2" y="26" width="2" height="8" fill="none" stroke="#60a5fa" strokeWidth="0.3" strokeOpacity="0.5" />
      <circle cx="6" cy="30" r="1.5" fill="none" stroke="#f97316" strokeWidth="0.4" strokeOpacity="0.7" />

      {/* Right three-point arc */}
      <path d="M 98 16 Q 78 30 98 44" fill="none" stroke="#3b82f6" strokeWidth="0.3" strokeOpacity="0.4" />
      {/* Right key */}
      <rect x="82" y="18" width="16" height="24" fill="none" stroke="#3b82f6" strokeWidth="0.3" strokeOpacity="0.4" />
      {/* Right free-throw circle */}
      <circle cx="82" cy="30" r="6" fill="none" stroke="#3b82f6" strokeWidth="0.3" strokeOpacity="0.3" strokeDasharray="1 1" />
      {/* Right basket */}
      <rect x="96" y="26" width="2" height="8" fill="none" stroke="#60a5fa" strokeWidth="0.3" strokeOpacity="0.5" />
      <circle cx="94" cy="30" r="1.5" fill="none" stroke="#f97316" strokeWidth="0.4" strokeOpacity="0.7" />

      {/* Ball glow */}
      <circle cx={bx} cy={by} r="5" fill="url(#ballGlow)">
        <animate attributeName="r" values="5;7;5" dur="1s" repeatCount="indefinite" />
      </circle>

      {/* Animated ball */}
      <circle cx={bx} cy={by} r="1.8" fill={ballColor}>
        <animate attributeName="r" values="1.8;2.2;1.8" dur="1s" repeatCount="indefinite" />
      </circle>
      {/* Ball seam */}
      <circle cx={bx} cy={by} r="1.8" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.15">
        <animate attributeName="r" values="1.8;2.2;1.8" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}
