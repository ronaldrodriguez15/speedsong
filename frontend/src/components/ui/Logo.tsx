interface LogoProps {
  compact?: boolean;
  light?: boolean;
  large?: boolean;
}

export function Logo({ compact = false, large = false }: LogoProps) {
  return (
    <div className={`inline-flex shrink-0 items-center justify-center bg-brand-500 ${large ? "rounded-2xl px-6 py-4" : "rounded-xl px-3 py-2"}`}>
      <img
        src={`${import.meta.env.BASE_URL}logo.avif`}
        alt="SpeedSong"
        className={`block object-contain ${large ? "h-16 w-52" : compact ? "h-8 w-24" : "h-10 w-36"}`}
        fetchPriority="high"
        decoding="async"
      />
    </div>
  );
}
