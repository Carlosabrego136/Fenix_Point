'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/Icon';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  badge?: number;
  section?: string;
}

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  let lastSection: string | undefined;
  return (
    <nav className="nav" aria-label="Principal">
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`);
        const sep = it.section && it.section !== lastSection ? <div className="nav__sep" key={`s-${it.section}`}>{it.section}</div> : null;
        lastSection = it.section;
        return (
          <span key={it.href} style={{ display: 'contents' }}>
            {sep}
            <Link href={it.href} aria-current={active ? 'page' : undefined}>
              <Icon name={it.icon} size={19} />
              <span>{it.label}</span>
              {it.badge ? <span className="nav__badge" aria-label={`${it.badge} pendientes`}>{it.badge}</span> : null}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
