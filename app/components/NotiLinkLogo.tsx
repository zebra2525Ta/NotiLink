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
      {/* Tag body */}
      <path
        d="M 20 5 L 80 5 Q 95 5 95 20 L 95 78 Q 95 95 78 95 L 35 95 L 5 65 L 5 20 Q 5 5 20 5 Z"
        fill="#F59E0B"
      />
      {/* Hole/grommet near top-left */}
      <circle cx="22" cy="22" r="7" fill="#190E00" />
      {/* Chain link — left ring */}
      <circle
        cx="38"
        cy="62"
        r="13"
        stroke="#B45309"
        strokeWidth="7"
        fill="none"
      />
      {/* Chain link — right ring */}
      <circle
        cx="62"
        cy="62"
        r="13"
        stroke="#B45309"
        strokeWidth="7"
        fill="none"
      />
    </svg>
  );
}
