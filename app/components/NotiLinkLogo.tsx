export default function NotiLinkLogo({
  size = 40,
  bg = "#100E0A",
  className = "",
}: {
  size?: number;
  bg?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer amber diamond */}
      <rect x="204" y="204" width="616" height="616" rx="56" fill="#f59e0b" transform="rotate(45 512 512)" />
      {/* Inner rect — same rotation as outer → same angle */}
      <rect x="316" y="316" width="392" height="392" rx="40" fill={bg} transform="rotate(45 512 512)" />
      {/* Center amber dot */}
      <circle cx="512" cy="512" r="112" fill="#f59e0b" />
      {/* Center hole */}
      <circle cx="512" cy="512" r="42" fill={bg} />
      {/* Grommet — outside diamond (upper-right, no overlap) */}
      <circle cx="790" cy="234" r="80" fill="#fcd34d" />
      {/* Grommet hole */}
      <circle cx="790" cy="234" r="30" fill={bg} />
    </svg>
  );
}
