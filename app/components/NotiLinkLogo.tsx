export default function NotiLinkLogo({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-15 -15 130 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g transform="rotate(-45 50 50)">
        {/* Tag body */}
        <path
          d="M 20 5 L 80 5 Q 95 5 95 20 L 95 78 Q 95 95 78 95 L 35 95 L 5 65 L 5 20 Q 5 5 20 5 Z"
          fill="#F59E0B"
        />
        {/* Hole — upper-right of body (appears upper-right after rotation) */}
        <circle cx="80" cy="22" r="7" fill="#190E00" />
        {/* Chain links — horizontal pair, becomes diagonal after -45° rotation */}
        <circle cx="35" cy="60" r="13" stroke="#B45309" strokeWidth="7" fill="none" />
        <circle cx="63" cy="60" r="13" stroke="#B45309" strokeWidth="7" fill="none" />
      </g>
    </svg>
  );
}
