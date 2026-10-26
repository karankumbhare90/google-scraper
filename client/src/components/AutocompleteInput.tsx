// ─── Autocomplete Input with Real-time Search & Suggestions ───────────────────
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, X, Check } from 'lucide-react'

export interface SuggestionItem {
  value: string
  label?: string
  category?: string
  icon?: React.ReactNode
}

interface AutocompleteInputProps {
  label: string
  placeholder: string
  value: string
  onChange: (val: string) => void
  suggestions: (string | SuggestionItem)[]
  icon?: React.ReactNode
  disabled?: boolean
  id?: string
}

export function AutocompleteInput({
  label,
  placeholder,
  value,
  onChange,
  suggestions,
  icon,
  disabled = false,
  id,
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Normalize suggestions
  const normalizedList: SuggestionItem[] = useMemo(() => {
    return suggestions.map((s) => {
      if (typeof s === 'string') {
        return { value: s, label: s }
      }
      return s
    })
  }, [suggestions])

  // Filter based on search query
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) {
      // Return top 15 suggestions when empty
      return normalizedList.slice(0, 15)
    }
    return normalizedList
      .filter((item) => {
        const valMatch = item.value.toLowerCase().includes(q)
        const labelMatch = item.label ? item.label.toLowerCase().includes(q) : false
        const catMatch = item.category ? item.category.toLowerCase().includes(q) : false
        return valMatch || labelMatch || catMatch
      })
      .slice(0, 25)
  }, [normalizedList, value])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(item: SuggestionItem) {
    onChange(item.value)
    setIsOpen(false)
    setHighlightIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1))
    } else if (e.key === 'Enter') {
      if (isOpen && highlightIndex >= 0 && highlightIndex < filtered.length) {
        e.preventDefault()
        handleSelect(filtered[highlightIndex])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setHighlightIndex(-1)
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{label}</span>
        {value && !disabled && (
          <span
            style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}
            onClick={() => { onChange(''); inputRef.current?.focus() }}
          >
            Clear
          </span>
        )}
      </label>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span style={{
            position: 'absolute', left: 12, display: 'flex', alignItems: 'center',
            color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1,
          }}>
            {icon}
          </span>
        )}

        <input
          ref={inputRef}
          id={id}
          className="input"
          style={{
            paddingLeft: icon ? 34 : 12,
            paddingRight: 56,
            width: '100%',
          }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
            setHighlightIndex(-1)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
        />

        <div style={{ position: 'absolute', right: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); inputRef.current?.focus() }}
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center',
              }}
              title="Clear"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center',
            }}
          >
            <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
          </button>
        </div>
      </div>

      {/* Suggestion Dropdown */}
      {isOpen && filtered.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-bright)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: 230,
          overflowY: 'auto',
          zIndex: 9999,
          padding: '4px',
        }}>
          {filtered.map((item, idx) => {
            const isSelected = item.value.toLowerCase() === value.trim().toLowerCase()
            const isHighlighted = idx === highlightIndex

            return (
              <div
                key={`${item.value}-${idx}`}
                onMouseDown={() => handleSelect(item)}
                onMouseEnter={() => setHighlightIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  cursor: 'pointer',
                  background: isHighlighted ? 'var(--bg-hover)' : isSelected ? 'var(--accent-dim)' : 'transparent',
                  color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                  transition: 'background 0.1s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {item.icon && <span style={{ flexShrink: 0 }}>{item.icon}</span>}
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontWeight: isSelected ? 600 : 400, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {item.label || item.value}
                    </span>
                    {item.category && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {item.category}
                      </span>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <Check size={13} style={{ color: 'var(--accent)', flexShrink: 0, marginLeft: 8 }} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
