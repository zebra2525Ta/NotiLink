export default function NaviLogo({
  size = 40,
  bg = "#0d0f14",
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
      {/* Outer indigo diamond */}
      <rect x="204" y="204" width="616" height="616" rx="80" fill="#6366f1" transform="rotate(45 512 512)" />
      {/* Inner cutout */}
      <rect x="316" y="316" width="392" height="392" rx="56" fill={bg} transform="rotate(45 512 512)" />
      {/* Center dot */}
      <circle cx="512" cy="512" r="112" fill="#818cf8" />
      {/* Center hole */}
      <circle cx="512" cy="512" r="42" fill={bg} />
      {/* Grommet */}
      <circle cx="790" cy="234" r="72" fill="#a5b4fc" />
      {/* Grommet hole */}
      <circle cx="790" cy="234" r="26" fill={bg} />
    </svg>
  );
}
