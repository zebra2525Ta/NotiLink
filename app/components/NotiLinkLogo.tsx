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
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Diamond ring: outer diamond minus inner diamond (same 45° rotation) */}
        <mask id="m-ring">
          <rect width="1024" height="1024" fill="white" />
          {/* Inner rect — exactly same transform as outer */}
          <rect
            x="316" y="316" width="392" height="392" rx="40"
            fill="black"
            transform="rotate(45 512 512)"
          />
        </mask>
        {/* Center dot hole */}
        <mask id="m-dot">
          <circle cx="512" cy="512" r="112" fill="white" />
          <circle cx="512" cy="512" r="42" fill="black" />
        </mask>
        {/* Grommet hole */}
        <mask id="m-grommet">
          <circle cx="790" cy="234" r="80" fill="white" />
          <circle cx="790" cy="234" r="30" fill="black" />
        </mask>
      </defs>

      {/* Outer amber diamond ring */}
      <rect
        x="204" y="204" width="616" height="616" rx="56"
        fill="#f59e0b"
        transform="rotate(45 512 512)"
        mask="url(#m-ring)"
      />
      {/* Center amber dot */}
      <circle cx="512" cy="512" r="112" fill="#f59e0b" mask="url(#m-dot)" />
      {/* Grommet — fully outside diamond (upper-right, no overlap) */}
      <circle cx="790" cy="234" r="80" fill="#fcd34d" mask="url(#m-grommet)" />
    </svg>
  );
}
