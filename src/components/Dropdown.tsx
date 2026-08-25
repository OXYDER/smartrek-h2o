import { useState } from 'react'

interface Option {
  value: string
  label: string
}

interface Props {
  label: string
  options: Option[]
  value: string
  onChange: (value: string) => void
}

export function Dropdown({ label, options, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border transition-colors ${
          current && current.value !== options[0].value
            ? 'border-sap text-sap bg-sap/10'
            : 'border-line text-muted hover:text-text'
        }`}
      >
        {label}
        {current && current.value !== options[0].value && (
          <span className="text-text">: {current.label}</span>
        )}
        <span className="text-[9px] opacity-70">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-30 min-w-[200px] rounded-lg border border-line bg-panel-raised shadow-[0_8px_24px_-4px_rgba(0,0,0,0.6)] py-1 flex flex-col">
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={`text-left text-sm px-3 py-1.5 transition-colors ${
                  o.value === value ? 'text-sap bg-sap/10' : 'text-text hover:bg-base'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
