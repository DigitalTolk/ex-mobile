interface BrandLogoProps {
  className?: string;
  label?: string;
}

export function BrandLogo({ className = 'brand-logo', label = 'DigitalTolk chat' }: BrandLogoProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label={label}>
      <path
        d="M12 12 H52 A6 6 0 0 1 58 18 V40 A6 6 0 0 1 52 46 H28 L18 56 V46 H12 A6 6 0 0 1 6 40 V18 A6 6 0 0 1 12 12 Z"
        fill="currentColor"
      />
      <circle cx="20" cy="29" r="3" fill="var(--logo-dot-color)" />
      <circle cx="32" cy="29" r="3" fill="var(--logo-dot-color)" />
      <circle cx="44" cy="29" r="3" fill="#de5d83" />
    </svg>
  );
}
