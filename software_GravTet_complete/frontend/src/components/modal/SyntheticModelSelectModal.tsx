/**
 * Full-screen modal grid for choosing a synthetic catalog model.
 */

import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { SYNTHETIC_MESH_SUFFIXES } from '../../pages/synthetic-gravity/constants/synthetic'

// --- Catalog row icon (shape family only; mesh type comes from the label string) ---

function ModelIcon({ modelType }: { modelType: string }) {
  const baseModel = modelType.split(' - ')[0]

  const iconStyle: CSSProperties = {
    width: '32px',
    height: '32px',
    display: 'inline-block',
    marginRight: '10px',
    verticalAlign: 'middle',
    flexShrink: 0,
  }

  switch (baseModel) {
    case 'Cube':
      return <div style={{ ...iconStyle, background: '#3b82f6', border: '1px solid #2563eb', borderRadius: '2px' }} title="Cube" />
    case 'Rectangular Prism (Cuboid)':
      return <div style={{ ...iconStyle, background: '#3b82f6', border: '1px solid #2563eb', borderRadius: '2px', transform: 'perspective(100px) rotateY(-15deg)', width: '38px' }} title="Rectangular Prism" />
    case 'Sphere':
      return <div style={{ ...iconStyle, background: '#3b82f6', border: '1px solid #2563eb', borderRadius: '50%' }} title="Sphere" />
    case 'Ellipsoid':
      return <div style={{ ...iconStyle, background: '#3b82f6', border: '1px solid #2563eb', borderRadius: '50%', width: '38px', height: '26px' }} title="Ellipsoid" />
    case 'Vertical Cylinder':
      return (
        <svg viewBox="0 0 24 24" style={{ ...iconStyle, width: '38px', height: '38px' }}>
          <title>Vertical Cylinder</title>
          <ellipse cx="12" cy="5.5" rx="6.5" ry="2.6" fill="#60a5fa" stroke="#2563eb" strokeWidth="1" />
          <rect x="5.5" y="5.5" width="13" height="12.5" fill="#3b82f6" stroke="#2563eb" strokeWidth="1" />
          <ellipse cx="12" cy="18" rx="6.5" ry="2.6" fill="#3b82f6" stroke="#2563eb" strokeWidth="1" />
        </svg>
      )
    case 'Horizontal Cylinder':
      return (
        <svg viewBox="0 0 28 24" style={{ ...iconStyle, width: '42px', height: '38px' }}>
          <title>Horizontal Cylinder</title>
          <rect x="6" y="6.5" width="14.5" height="11" fill="#3b82f6" stroke="#2563eb" strokeWidth="1" />
          <ellipse cx="6" cy="12" rx="2.8" ry="5.5" fill="#60a5fa" stroke="#2563eb" strokeWidth="1" />
          <ellipse cx="20.5" cy="12" rx="2.8" ry="5.5" fill="#3b82f6" stroke="#2563eb" strokeWidth="1" />
        </svg>
      )
    case '4 Cubes':
      return (
        <div style={{ ...iconStyle, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px', padding: '3px' }} title="4 Cubes">
          <div style={{ width: '14px', height: '14px', background: '#3b82f6', border: '1px solid #2563eb', borderRadius: '2px' }} />
          <div style={{ width: '14px', height: '14px', background: '#3b82f6', border: '1px solid #2563eb', borderRadius: '2px' }} />
          <div style={{ width: '14px', height: '14px', background: '#3b82f6', border: '1px solid #2563eb', borderRadius: '2px' }} />
          <div style={{ width: '14px', height: '14px', background: '#3b82f6', border: '1px solid #2563eb', borderRadius: '2px' }} />
        </div>
      )
    case 'Faulted Block Model':
      return (
        <div style={{ ...iconStyle, position: 'relative', width: '36px', height: '32px' }} title="Faulted Block">
          <div style={{ width: '26px', height: '16px', background: '#3b82f6', border: '1px solid #2563eb', borderRadius: '2px', position: 'absolute', top: '0', left: '0', transform: 'rotate(-5deg)' }} />
          <div style={{ width: '26px', height: '16px', background: '#3b82f6', border: '1px solid #2563eb', borderRadius: '2px', position: 'absolute', bottom: '0', right: '0', transform: 'rotate(5deg)' }} />
        </div>
      )
    case 'Valley-Mountain Model':
      return (
        <svg viewBox="0 0 24 24" style={{ ...iconStyle, width: '42px', height: '38px' }}>
          <title>Valley-Mountain</title>
          <path d="M2 17 L2 20 L22 20 L22 17 L18 17 L15 13 L12 11 L9 14 L6 9 L2 17 Z" fill="#3b82f6" stroke="#2563eb" strokeWidth="1" />
        </svg>
      )
    default:
      return <div style={iconStyle} />
  }
}

// --- Portal + full-viewport grid (synthetic gravity model picker) ---

/** Full-page modal for Synthetic Gravity model selection. One row per shape, mesh-kind buttons. */
export default function SyntheticModelSelectModal({
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  title: string
  options: string[]
  selected: string | null
  onSelect: (value: string) => void
  onClose: () => void
}) {
  const rows = useMemo(() => {
    const byShape = new Map<string, string[]>()
    for (const opt of options) {
      const sep = opt.indexOf(' - ')
      if (sep < 0) continue
      const shape = opt.slice(0, sep)
      const suffix = opt.slice(sep + 3)
      const list = byShape.get(shape) ?? []
      list.push(suffix)
      byShape.set(shape, list)
    }
    return Array.from(byShape.entries()).map(([shape, suffixes]) => ({
      shape,
      entries: SYNTHETIC_MESH_SUFFIXES.filter((suffix) => suffixes.includes(suffix)).map((suffix) => ({
        suffix,
        value: `${shape} - ${suffix}`,
      })),
    }))
  }, [options])

  const modal = (
    <div className="synthetic-model-modal-overlay" onClick={onClose} style={{ background: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="synthetic-model-modal-content" onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff' }}>
        <div className="synthetic-model-modal-header">
          <h2 className="synthetic-model-modal-title">{title}</h2>
          <button type="button" className="synthetic-model-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="synthetic-model-modal-rows">
          {rows.map(({ shape, entries }) => (
            <div key={shape} className="synthetic-model-modal-row">
              <div className="synthetic-model-modal-row-shape">
                <ModelIcon modelType={shape} />
                <span className="synthetic-model-modal-row-shape-text">{shape}</span>
              </div>
              <div className="synthetic-model-modal-row-meshes">
                {entries.map(({ suffix, value }) => {
                  const isActive = selected === value
                  return (
                    <button
                      key={value}
                      type="button"
                      className={`synthetic-model-modal-mesh-btn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        onSelect(value)
                        onClose()
                      }}
                      title={value}
                    >
                      {suffix}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
  return createPortal(modal, document.body)
}
