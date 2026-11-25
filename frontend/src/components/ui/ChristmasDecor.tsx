import type { CSSProperties } from 'react';

export function ChristmasLights() {
  return <div className="christmas-lights" aria-hidden="true">
    {Array.from({ length: 24 }, (_, index) => <span key={index} style={{ '--bulb-color': ['#fda4af', '#fcd34d', '#6ee7b7', '#bae6fd'][index % 4], animationDelay: `${index % 5 * -.7}s` } as CSSProperties} />)}
  </div>;
}

export function Snowman({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 120 136" fill="none" aria-hidden="true" className={className}>
    <ellipse cx="60" cy="128" rx="43" ry="5" fill="#93c5fd" opacity=".25" />
    <path d="M31 84 12 70m4 3-1-9m1 9-9 1M89 84l19-14m-4 3 1-9m-1 9 9 1" stroke="#a57858" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="60" cy="99" rx="32" ry="28" fill="#f8fafc" stroke="#bfdbfe" strokeWidth="2" />
    <circle cx="60" cy="55" r="24" fill="#fff" stroke="#bfdbfe" strokeWidth="2" />
    <path d="M38 40c0-23 14-33 29-28l17 16-17-3-6 16" fill="#e44858" />
    <circle cx="84" cy="28" r="7" fill="#fff" />
    <rect x="33" y="35" width="49" height="11" rx="5.5" fill="#f1f5f9" stroke="#bfdbfe" />
    <circle cx="52" cy="54" r="2.4" fill="#1e293b" /><circle cx="68" cy="54" r="2.4" fill="#1e293b" />
    <path d="m60 59 13 4-13 3Z" fill="#fb923c" />
    <path d="M52 69q8 7 16 0" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
    <circle cx="44" cy="63" r="4" fill="#fecdd3" /><circle cx="76" cy="63" r="4" fill="#fecdd3" />
    <path d="M40 76q20 9 40 0" stroke="#059669" strokeWidth="10" strokeLinecap="round" />
    <path d="m72 80-2 20" stroke="#059669" strokeWidth="10" /><path d="m66 94 9 1" stroke="#a7f3d0" strokeWidth="3" />
    <circle cx="58" cy="94" r="2.5" fill="#334155" /><circle cx="58" cy="107" r="2.5" fill="#334155" />
    <path d="M16 29v12m-6-6h12M99 46v10m-5-5h10" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

export function ChristmasGreeting() {
  return <div className="christmas-greeting flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-2 dark:border-emerald-900 dark:bg-emerald-950/40">
    <Snowman className="h-20 w-16 shrink-0" />
    <div><p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">¡Feliz Navidad!</p><p className="mt-1 text-xs leading-5 text-emerald-700 dark:text-emerald-300">Que esta temporada esté llena de alegría.</p></div>
  </div>;
}
