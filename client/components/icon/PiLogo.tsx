export function PiLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <rect
        x="8"
        y="8"
        width="112"
        height="112"
        rx="22"
        fill="var(--canvas)"
        stroke="var(--sidebar-border)"
        strokeWidth="3"
      />
      <g transform="translate(64, 44)">
        <line
          x1="-30"
          y1="0"
          x2="30"
          y2="0"
          stroke="var(--primary)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <line
          x1="-18"
          y1="0"
          x2="-18"
          y2="34"
          stroke="var(--primary)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <line
          x1="18"
          y1="0"
          x2="18"
          y2="34"
          stroke="var(--primary)"
          strokeWidth="10"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
