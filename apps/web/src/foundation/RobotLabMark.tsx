import type { SVGProps } from "react";

type RobotLabMarkProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

/** Original inline Robot Lab mark: a compact robot face with an OTT gesture core. */
export function RobotLabMark({ size = 32, ...props }: RobotLabMarkProps) {
  return (
    <svg
      {...props}
      data-brand="robot-lab"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="OTT v2 Robot Lab"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <path d="M18 8h12" />
      <path d="M24 8V4" />
      <circle cx="24" cy="3.5" r="1.5" fill="currentColor" stroke="none" />
      <rect x="7" y="12" width="34" height="28" rx="8" fill="currentColor" fillOpacity=".1" />
      <path d="M7 21h-3m37 0h3" />
      <circle cx="17" cy="25" r="3.2" fill="currentColor" fillOpacity=".2" />
      <circle cx="31" cy="25" r="3.2" fill="currentColor" fillOpacity=".2" />
      <path d="M17 25h.01m14-.01h.01" strokeWidth="3.8" />
      <path d="M16 33c2.2 2 4.8 3 8 3s5.8-1 8-3" />
      <path d="m21 30 3-3 3 3-3 3-3-3Z" fill="currentColor" fillOpacity=".22" />
      <path d="M12 40v4m24-4v4" />
    </svg>
  );
}
