'use client'

import { useState, useRef, useEffect } from 'react'
import Avatar from './Avatar'

interface Profile { id: string; name: string }

interface Props {
  label: string
  value: Profile[]
  multi: boolean
  profiles: Profile[]
  onChange: (added: Profile | null, removed: Profile | null) => void
}

export default function AssigneePicker({ label, value, multi, profiles, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  function toggle(p: Profile) {
    const exists = value.find(v => v.id === p.id)
    if (exists) { onChange(null, p) }
    else { if (!multi && value.length > 0) onChange(null, value[0]); onChange(p, null) }
    if (!multi) setOpen(false)
  }
  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1.5 flex-wrap cursor-pointer" onClick={() => setOpen(true)}>
        {value.length === 0
          ? <span className="text-xs text-gray-400 border border-dashed border-gray-200 px-2 py-0.5 rounded hover:border-gray-400">+ {label}</span>
          : value.map((p, i) => (
            <div key={p.id} className="flex items-center gap-1">
              <Avatar name={p.name} idx={i} />
              <span className="text-xs text-gray-700">{p.name}</span>
            </div>
          ))
        }
        {value.length > 0 && <span className="text-xs text-gray-300 hover:text-gray-600 ml-0.5">+</span>}
      </div>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 min-w-40 py-1">
          {profiles.map((p, i) => {
            const selected = !!value.find(v => v.id === p.id)
            return (
              <button key={p.id} onClick={() => toggle(p)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${selected ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                <Avatar name={p.name} idx={i} />
                <span>{p.name}</span>
                {selected && <span className="ml-auto text-yellow-500 text-xs">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
