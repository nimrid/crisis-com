export function GraceGuardLogo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="11" className="fill-primary" />
      <path
        d="M20 7.5L30.5 11.7V19.6C30.5 26.1 26.05 31.35 20 33C13.95 31.35 9.5 26.1 9.5 19.6V11.7L20 7.5Z"
        className="stroke-primary-foreground/35"
        strokeWidth="1.5"
      />
      <path
        d="M15.2 26.5V19.2C15.2 16.55 17.35 14.4 20 14.4C22.65 14.4 24.8 16.55 24.8 19.2V26.5"
        className="stroke-primary-foreground"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 11.2V26.5M16.5 19.2H23.5"
        className="stroke-primary-foreground"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="20" cy="11.2" r="1.35" className="fill-warning" />
    </svg>
  );
}
