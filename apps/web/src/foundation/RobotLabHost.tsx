import type { SVGProps } from "react";

type RobotLabHostProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

/** Deterministic full-body Robot Lab host used by hero and empty-state compositions. */
export function RobotLabHost({ size = 280, ...props }: RobotLabHostProps) {
  return (
    <svg
      {...props}
      data-robot="full-body"
      width={size}
      height={size}
      viewBox="0 0 320 320"
      role="img"
      aria-label="Robot chủ nhà Robot Lab"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
    >
      <defs>
        <linearGradient id="robot-shell" x1="80" y1="48" x2="250" y2="274" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EAF4FB" />
          <stop offset="1" stopColor="#9FB4C7" />
        </linearGradient>
        <linearGradient id="robot-chest" x1="134" y1="190" x2="190" y2="262" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D4E3EF" />
          <stop offset="1" stopColor="#91A9BD" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="292" rx="94" ry="12" stroke="#69EEE7" strokeOpacity=".62" strokeWidth="3" />
      <path d="M160 40V22" stroke="#A9C0D1" strokeWidth="6" strokeLinecap="round" />
      <rect x="151" y="12" width="18" height="18" rx="7" fill="#69EEE7" />
      <rect x="61" y="102" width="28" height="70" rx="14" fill="url(#robot-shell)" stroke="#8AA1B4" strokeWidth="4" />
      <rect x="231" y="102" width="28" height="70" rx="14" fill="url(#robot-shell)" stroke="#8AA1B4" strokeWidth="4" />
      <rect x="71" y="115" width="9" height="35" rx="4.5" fill="#69EEE7" />
      <rect x="240" y="115" width="9" height="35" rx="4.5" fill="#69EEE7" />
      <rect x="75" y="44" width="170" height="137" rx="48" fill="url(#robot-shell)" stroke="#8AA1B4" strokeWidth="5" />
      <rect x="94" y="79" width="132" height="78" rx="30" fill="#13283D" stroke="#6F879B" strokeWidth="5" />
      <ellipse cx="139" cy="117" rx="12" ry="22" fill="#69EEE7" transform="rotate(-8 139 117)" />
      <ellipse cx="181" cy="117" rx="12" ry="22" fill="#69EEE7" transform="rotate(8 181 117)" />
      <path d="M103 171C111 187 127 196 160 196C193 196 209 187 217 171" fill="#C4D5E2" stroke="#8AA1B4" strokeWidth="4" />
      <path d="M119 179C131 190 145 194 160 194C175 194 189 190 201 179" stroke="#69EEE7" strokeOpacity=".8" strokeWidth="4" strokeLinecap="round" />
      <path d="M119 195L95 230L112 242L140 211" fill="url(#robot-shell)" stroke="#8AA1B4" strokeWidth="5" />
      <path d="M201 195L225 230L208 242L180 211" fill="url(#robot-shell)" stroke="#8AA1B4" strokeWidth="5" />
      <path d="M86 229C74 230 66 240 70 251C75 263 89 266 100 259L112 242L96 231Z" fill="#F7FBFF" stroke="#8AA1B4" strokeWidth="5" />
      <path d="M234 229C246 230 254 240 250 251C245 263 231 266 220 259L208 242L224 231Z" fill="#F7FBFF" stroke="#8AA1B4" strokeWidth="5" />
      <rect x="107" y="181" width="106" height="100" rx="34" fill="url(#robot-chest)" stroke="#8AA1B4" strokeWidth="5" />
      <rect x="130" y="203" width="60" height="42" rx="13" fill="#16384A" stroke="#69EEE7" strokeWidth="3" />
      <text x="160" y="231" textAnchor="middle" fill="#69EEE7" fontFamily="Be Vietnam Pro, sans-serif" fontSize="20" fontWeight="900">OTT</text>
      <path d="M123 278V293M197 278V293" stroke="#8AA1B4" strokeWidth="12" strokeLinecap="round" />
      <path d="M106 294H137M183 294H214" stroke="#D4E3EF" strokeWidth="18" strokeLinecap="round" />
    </svg>
  );
}
