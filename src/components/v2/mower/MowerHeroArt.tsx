import {useId} from 'react';

export interface MowerHeroArtProps {
  className?: string;
  width?: number;
}

/** The static three-quarter-view mower illustration — ported 1:1 from the concept's Device
 *  Home hero (docs/concept/openmower-app-concept.html "B · DEVICE HOME"). A placeholder for
 *  a real 3D scan of the user's own YardForce (the concept's stated intent for this slot);
 *  gradient ids are namespaced per-instance via useId so the art can render more than once
 *  on a page (mobile hero + desktop hero card). */
export function MowerHeroArt({className, width = 192}: MowerHeroArtProps) {
  const uid = useId();
  const shell = `mwr-shell-${uid}`;
  const shellSide = `mwr-shell-side-${uid}`;
  const wheel = `mwr-wheel-${uid}`;
  const bumper = `mwr-bumper-${uid}`;

  return (
    <svg
      viewBox="0 0 260 160"
      width={width}
      role="img"
      aria-label="A YardForce SA900ECO robot mower, orange and black, rendered in three-quarter view"
      className={className}
    >
      <defs>
        <linearGradient id={shell} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF8B3E" />
          <stop offset=".45" stopColor="#F26A1B" />
          <stop offset="1" stopColor="#D2540F" />
        </linearGradient>
        <linearGradient id={shellSide} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C8500E" />
          <stop offset=".5" stopColor="#F26A1B" />
          <stop offset="1" stopColor="#B94709" />
        </linearGradient>
        <radialGradient id={wheel} cx=".38" cy=".34" r=".8">
          <stop offset="0" stopColor="#3A3A3E" />
          <stop offset="1" stopColor="#111114" />
        </radialGradient>
        <linearGradient id={bumper} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2C2C31" />
          <stop offset="1" stopColor="#141417" />
        </linearGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="132" cy="141" rx="94" ry="12" fill="#000" opacity=".16" />

      {/* far (front) wheel */}
      <circle cx="72" cy="118" r="17" fill={`url(#${wheel})`} />
      <circle cx="72" cy="118" r="6" fill="#F26A1B" />

      {/* underside / cutting deck hint */}
      <ellipse cx="132" cy="120" rx="72" ry="16" fill="#0E0E11" />

      {/* body: black chassis band */}
      <path
        d="M44 112 C40 96 44 92 60 91 L206 91 C222 92 224 98 220 112 C216 122 60 122 44 112 Z"
        fill={`url(#${bumper})`}
      />

      {/* body: orange shell */}
      <path
        d="M50 96 C44 66 66 47 108 45 L164 45 C206 46 218 66 214 96 C210 100 60 100 50 96 Z"
        fill={`url(#${shell})`}
      />
      {/* side facet for depth */}
      <path
        d="M214 96 C218 66 206 46 164 45 L176 45 C210 48 220 70 216 98 Z"
        fill={`url(#${shellSide})`}
        opacity=".9"
      />
      {/* top highlight */}
      <path d="M62 60 C74 50 96 48 120 48 C112 54 92 58 78 66 C72 63 66 62 62 60 Z" fill="#FFFFFF" opacity=".22" />
      {/* panel seam */}
      <path d="M60 84 C110 90 170 90 208 84" fill="none" stroke="#00000030" strokeWidth="2" />

      {/* front bumper lip */}
      <path d="M48 100 C44 90 50 88 60 88 L74 88 C64 92 56 96 54 102 Z" fill="#141417" />

      {/* top: cutting-height dial */}
      <ellipse cx="126" cy="52" rx="17" ry="7" fill="#141417" />
      <ellipse cx="126" cy="49" rx="17" ry="7" fill="#F26A1B" />
      <ellipse cx="126" cy="49" rx="8" ry="3.4" fill="#FF9A54" />

      {/* top: STOP button */}
      <ellipse cx="164" cy="53" rx="12" ry="5" fill="#7E1710" />
      <ellipse cx="164" cy="50.5" rx="12" ry="5" fill="#D23B2C" />

      {/* OpenMower RTK antenna puck (rear, on a short mast) */}
      <rect x="190" y="44" width="4" height="14" rx="2" fill="#26262A" />
      <ellipse cx="192" cy="44" rx="12" ry="5" fill="#1E1E22" />
      <ellipse cx="192" cy="42" rx="12" ry="5" fill="#33333A" />
      <circle cx="192" cy="42" r="2.4" fill="#2FBE7E" />

      {/* near (rear) wheel */}
      <circle cx="196" cy="120" r="22" fill={`url(#${wheel})`} />
      <circle cx="196" cy="120" r="22" fill="none" stroke="#000" strokeWidth="2" opacity=".5" />
      <g stroke="#050506" strokeWidth="2.4" opacity=".7">
        <path d="M196 100 v6M196 134 v6M176 120 h6M210 120 h6M182 106 l4 4M206 130 l4 4M210 106 l-4 4M186 130 l-4 4" />
      </g>
      <circle cx="196" cy="120" r="8" fill="#26262A" />
      <circle cx="196" cy="120" r="8" fill="none" stroke="#F26A1B" strokeWidth="2" />
    </svg>
  );
}
