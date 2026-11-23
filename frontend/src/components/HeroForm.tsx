/**
 * The overview's centrepiece, where the reference stands its chrome sculpture: a soft form of satin
 * silver (a still render, public/hero-form.webp) that floats gently over its shadow on the glass.
 * While verdicts load it floats a little faster. It holds still for reduced motion.
 */
export function HeroForm({ busy = false, className = '' }: { busy?: boolean; className?: string }) {
  return (
    <div className={`hero-form relative ${className}`} data-busy={busy} aria-hidden>
      <span className="hero-form-shadow" />
      <img src="/hero-form.webp" alt="" width={675} height={574} decoding="async" draggable={false} className="hero-form-img relative block h-auto w-full select-none" />
    </div>
  )
}
