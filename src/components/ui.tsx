import type { ReactNode } from 'react'
import {
  CheckmarkCircleRegular,
  ErrorCircleRegular,
  InfoRegular,
  WarningRegular,
} from '@fluentui/react-icons'
import type { Option, Tone } from '../data/options'
import { labelOf, toneOf } from '../data/options'
import { useRoute } from '../lib/router'
import { navItems } from './nav'

export function PageHeader({
  title,
  lead,
  actions,
  tone = 'light',
  className,
}: {
  title: string
  lead?: ReactNode
  actions?: ReactNode
  tone?: 'light' | 'dark'
  className?: string
}) {
  const { route } = useRoute()
  const group = navItems.find((n) => n.id === route)?.group
  return (
    <header className={`page-header bleed ${tone}${tone === 'dark' ? ' on-dark' : ''}${className ? ` ${className}` : ''}`}>
      <div className="page-header-inner">
        <div className="ph-text">
          {group && <div className="eyebrow">{group}</div>}
          <h1>{title}</h1>
          {lead && <p className="lead">{lead}</p>}
        </div>
        {actions && <div className="actions no-print">{actions}</div>}
      </div>
    </header>
  )
}

export function Section({
  title,
  sub,
  actions,
  children,
  flush,
  id,
  tone,
  band,
}: {
  title: ReactNode
  sub?: ReactNode
  actions?: ReactNode
  children: ReactNode
  flush?: boolean
  id?: string
  /** ice: خلفية جليدية، dark: خلفية كحلية بنص فاتح */
  tone?: 'ice' | 'dark'
  /** شريط بعرض الصفحة: dark أزرق داكن، ivory طبقة فاتحة (للأقسام المحورية فقط) */
  band?: 'dark' | 'ivory'
}) {
  const bandClass = band ? ` band-sec bleed band-${band}${band === 'dark' ? ' on-dark' : ''}` : ''
  return (
    <section className={`section${tone ? ` tone-${tone}` : ''}${tone === 'dark' ? ' on-dark' : ''}${bandClass}`} id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="section-head">
        <div>
          <h2 id={id ? `${id}-title` : undefined} className="section-title">
            {title}
          </h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {actions && <div className="row no-print">{actions}</div>}
      </div>
      <div className={`section-body${flush ? ' flush' : ''}`}>{children}</div>
    </section>
  )
}

export function Badge({ tone = 'neutral', children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`badge ${tone}`}>
      {dot && <span className="dot" aria-hidden />}
      {children}
    </span>
  )
}

export function StatusBadge({ options, value }: { options: Option[]; value: string }) {
  return <Badge tone={toneOf(options, value)}>{labelOf(options, value)}</Badge>
}

const msgIcons = {
  info: InfoRegular,
  warning: WarningRegular,
  danger: ErrorCircleRegular,
  success: CheckmarkCircleRegular,
}

export function Message({
  tone = 'info',
  title,
  children,
  actions,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success'
  title?: ReactNode
  children?: ReactNode
  actions?: ReactNode
}) {
  const Icon = msgIcons[tone]
  return (
    <div className={`msg ${tone}`} role={tone === 'danger' ? 'alert' : 'note'}>
      <Icon aria-hidden />
      <div className="msg-body">
        {title && <div className="msg-title">{title}</div>}
        {children && <div>{children}</div>}
      </div>
      {actions && <div className="row no-print">{actions}</div>}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="row" style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}

export function Value({ v, empty = 'لم يُسجل بعد' }: { v?: string | null; empty?: string }) {
  return v && v.trim() ? <>{v}</> : <span className="empty-value">{empty}</span>
}

export function Progress({ pct, tone }: { pct: number; tone?: 'success' | 'warning' }) {
  const p = Math.max(0, Math.min(100, pct))
  return (
    <div className={`progress ${tone ?? ''}`} role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${p}%` }} />
    </div>
  )
}

export function DescList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="dl">
      {items.map((it) => (
        <div key={it.label}>
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** رابط خارجي آمن مع عرض صحيح للنص الإنجليزي داخل سياق عربي */
export function ExtLink({ url, children }: { url: string; children?: ReactNode }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {children ?? <bdi className="ltr">{url}</bdi>}
    </a>
  )
}
