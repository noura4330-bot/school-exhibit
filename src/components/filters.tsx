import { useId } from 'react'
import { SearchRegular } from '@fluentui/react-icons'
import type { Option } from '../data/options'

export function SearchBox({ value, onChange, label = 'بحث', placeholder }: { value: string; onChange: (v: string) => void; label?: string; placeholder?: string }) {
  const id = useId()
  return (
    <div className="field search">
      <label htmlFor={id}>{label}</label>
      <div className="search-input">
        <SearchRegular aria-hidden />
        <input id={id} className="input" type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  )
}

export function SelectFilter({
  label,
  value,
  onChange,
  options,
  allLabel = 'الكل',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Option[]
  allLabel?: string
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function DateRange({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
}) {
  const id = useId()
  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-f`}>من تاريخ</label>
        <input id={`${id}-f`} className="input" type="date" value={from} max={to || undefined} onChange={(e) => onFrom(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-t`}>إلى تاريخ</label>
        <input id={`${id}-t`} className="input" type="date" value={to} min={from || undefined} onChange={(e) => onTo(e.target.value)} />
      </div>
    </>
  )
}

export function ClearFilters({ active, onClear }: { active: boolean; onClear: () => void }) {
  if (!active) return null
  return (
    <button className="btn subtle" onClick={onClear}>
      مسح التصفية
    </button>
  )
}

export const uniqueOptions = (values: string[]): Option[] =>
  Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'ar'))
    .map((v) => ({ value: v, label: v }))
