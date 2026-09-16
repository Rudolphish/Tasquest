import type { Route } from 'next';

const ITEMS: { href: Route; label: string; caption: string }[] = [
  { href: '/today', label: 'TODAY', caption: '本日' },
  { href: '/goals', label: 'QUESTS', caption: '目標' },
  { href: '/log', label: 'RECORD', caption: '記録' },
];

export function CommandBar({ current }: { current: string }) {
  return (
    <nav className="command-bar">
      {ITEMS.map((item) => (
        <a key={item.href} href={item.href} data-active={current === item.href}>
          <span className="numeric" style={{ fontSize: 13, letterSpacing: '0.18em' }}>
            {item.label}
          </span>
          <span style={{ fontSize: 11, opacity: 0.7 }}>{item.caption}</span>
        </a>
      ))}
    </nav>
  );
}
