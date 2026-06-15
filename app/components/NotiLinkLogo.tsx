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
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Diamond body — rounded square rotated 45° */}
      <rect
        x="17"
        y="17"
        width="66"
        height="66"
        rx="14"
        fill="#F59E0B"
        transform="rotate(45 50 50)"
      />
      {/* Grommet — upper-right shoulder */}
      <circle cx="76" cy="24" r="7" fill="#190E00" />
      {/* Chain link rings */}
      <circle cx="39" cy="59" r="11" stroke="#B45309" strokeWidth="6" fill="none" />
      <circle cx="61" cy="59" r="11" stroke="#B45309" strokeWidth="6" fill="none" />
    </svg>
  );
}
