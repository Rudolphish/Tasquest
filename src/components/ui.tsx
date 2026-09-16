/** 画面をまたいで使う小さな部品。 */

/** 見出しの上に置く欧文ラベル。 */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

/** 区切り線つきの節見出し。 */
export function SectionRule({ label, trailing }: { label: string; trailing?: React.ReactNode }) {
  return (
    <div className="rule">
      <span className="numeric" style={{ fontSize: 12, letterSpacing: '0.24em', color: 'var(--text-2)' }}>
        {label}
      </span>
      {trailing}
    </div>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

/** 工数区分の表示。値そのものはデータベースが決める。 */
export function EffortBadge({ effort }: { effort: 'S' | 'M' | 'L' }) {
  return (
    <span
      className="numeric"
      style={{
        width: 26,
        height: 26,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--line-strong)',
        fontSize: 12,
        color: 'var(--text-2)',
        flexShrink: 0,
      }}
    >
      {effort}
    </span>
  );
}

export function CheckIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={2.2}>
      <path d="M4.5 10.5l4 4 7.5-8.5" />
    </svg>
  );
}

export function Diamond({ size = 22, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        border: `1px solid ${filled ? 'var(--cyan)' : 'var(--line-strong)'}`,
        background: filled ? 'var(--cyan)' : 'transparent',
        transform: 'rotate(45deg)',
        flexShrink: 0,
      }}
    />
  );
}
