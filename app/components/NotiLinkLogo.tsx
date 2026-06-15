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
        <mask id="m-ring">
          <rect width="1024" height="1024" fill="white" />
          <rect x="306" y="306" width="412" height="412" rx="40" fill="black" transform="rotate(45 512 512)" />
        </mask>
        <mask id="m-dot">
          <circle cx="512" cy="512" r="112" fill="white" />
          <circle cx="512" cy="512" r="42" fill="black" />
        </mask>
        <mask id="m-grommet">
          <circle cx="710" cy="314" r="130" fill="white" />
          <circle cx="710" cy="314" r="50" fill="black" />
        </mask>
      </defs>
      <rect x="204" y="204" width="616" height="616" rx="56" fill="#f59e0b" transform="rotate(45 512 512)" mask="url(#m-ring)" />
      <circle cx="512" cy="512" r="112" fill="#f59e0b" mask="url(#m-dot)" />
      <circle cx="710" cy="314" r="130" fill="#fcd34d" mask="url(#m-grommet)" />
    </svg>
  );
}
