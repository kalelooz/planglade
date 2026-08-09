import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarDays, Check, ChevronDown, Palette } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { PROJECT_COLORS } from '@/lib/project-fields'
import { PROJECT_ICONS, projectIcon, type ProjectIconName } from '@/lib/project-icons'

export function ProjectDateField({
  id,
  label,
  value,
  onChange,
  min,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  min?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseISO(value) : undefined
  return (
    <div>
      <label htmlFor={id} className="text-[12px] text-muted-foreground">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            className="mt-1 inline-flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-[13px] outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className={cn('truncate', !value && 'text-muted-foreground')}>{value ? format(selected!, 'MMM d, yyyy') : 'Set date'}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            disabled={min ? { before: parseISO(min) } : undefined}
            onSelect={(date) => {
              onChange(date ? format(date, 'yyyy-MM-dd') : '')
              if (date) setOpen(false)
            }}
            initialFocus
          />
          {value && (
            <div className="border-t border-border p-2">
              <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="h-8 w-full rounded-md text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                Clear date
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function ProjectColorField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const selected = PROJECT_COLORS.find((color) => color.value === value)
  return (
    <div>
      <label htmlFor={id} className="text-[12px] text-muted-foreground">Project color</label>
      <div className="mt-1 flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button id={id} type="button" className="inline-flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-[13px] outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: value }} aria-hidden />
              <span className="truncate">{selected?.name ?? 'Custom'}</span>
              <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start" collisionPadding={16}>
            <p className="mb-2 text-[12.5px] font-medium text-muted-foreground">Choose a color</p>
            <div className="grid grid-cols-5 gap-2" role="group" aria-label="Project colors">
              {PROJECT_COLORS.map((color) => {
                const active = color.value === value
                return (
                  <button key={color.value} type="button" aria-label={color.name} aria-pressed={active} title={color.name} onClick={() => onChange(color.value)} className="relative grid h-8 w-8 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <span className="absolute inset-0 rounded-full border border-black/10" style={{ backgroundColor: color.value }} aria-hidden />
                    {active && <Check className="relative h-4 w-4 text-white drop-shadow-sm" strokeWidth={3} aria-hidden />}
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
        <label className="relative grid h-9 w-10 shrink-0 cursor-pointer place-items-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring" title="Open advanced color picker">
          <Palette className="h-4 w-4" aria-hidden />
          <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full border border-background" style={{ backgroundColor: value }} aria-hidden />
          <input
            id={`${id}-advanced`}
            type="color"
            aria-label="Open advanced color picker"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  )
}

export function ProjectIconField({ id, value, color, onChange }: { id: string; value: ProjectIconName; color: string; onChange: (value: ProjectIconName) => void }) {
  const [open, setOpen] = useState(false)
  const selected = projectIcon(value)
  const SelectedIcon = selected.icon
  return (
    <div>
      <label htmlFor={id} className="text-[12px] text-muted-foreground">Project icon</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button id={id} type="button" className="mt-1 inline-flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-[13px] outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring">
            <SelectedIcon className="h-4 w-4 shrink-0" style={{ color }} aria-hidden />
            <span className="truncate">{selected.label}</span>
            <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start" collisionPadding={16}>
          <p className="mb-2 text-[12.5px] font-medium text-muted-foreground">Choose an icon</p>
          <div className="grid grid-cols-7 gap-1" role="group" aria-label="Project icons">
            {PROJECT_ICONS.map((item) => {
              const Icon = item.icon
              const active = item.name === value
              return (
                <button key={item.name} type="button" aria-label={item.label} aria-pressed={active} title={item.label} onClick={() => onChange(item.name)} className={cn('grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring', active && 'bg-accent text-foreground ring-1 ring-border')}>
                  <Icon className="h-4 w-4" style={{ color }} aria-hidden />
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
