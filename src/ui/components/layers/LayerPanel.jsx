import { useEffect, useState } from 'react'
import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import IconButton from '../common/IconButton.jsx'
import Slider from '../common/Slider.jsx'
import Select from '../common/Select.jsx'
import { OPTION_DEFS } from '../../data/tools.js'
import { useUi } from '../../state/context.js'

/**
 * Layer stack.
 *
 * Order note: `layers[0]` is the *top* of the stack (paint-over order), which
 * is how the list renders. The engine must adopt the same convention in
 * Phase 5 so this component needs no rewrite.
 */
export default function LayerPanel() {
  const {
    layers,
    activeLayerId,
    selectLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    setLayerOpacity,
    setLayerBlend,
    addLayer,
    duplicateLayer,
    deleteLayer,
    renameLayer,
  } = useUi()

  const active = layers.find((layer) => layer.id === activeLayerId) ?? null

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-0.5">
        <IconButton icon="plus" label="Add a new layer" onClick={addLayer} />
        <IconButton
          icon="copy"
          label="Duplicate the active layer"
          disabled={!active}
          onClick={() => duplicateLayer(active.id)}
        />
        <IconButton
          icon="trash"
          label="Delete the active layer"
          disabled={!active || layers.length <= 1}
          onClick={() => deleteLayer(active.id)}
        />
        <div className="flex-1" />
        <span className="font-mono text-[10px] text-fg-subtle tabular-nums">
          {layers.length} {layers.length === 1 ? 'layer' : 'layers'}
        </span>
      </div>

      <ul className="scroll-slim flex max-h-[16.5rem] flex-col gap-1 overflow-y-auto pr-0.5">
        {layers.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            active={layer.id === activeLayerId}
            onSelect={() => selectLayer(layer.id)}
            onToggleVisible={() => toggleLayerVisibility(layer.id)}
            onToggleLock={() => toggleLayerLock(layer.id)}
            onRename={(name) => renameLayer(layer.id, name)}
            onMove={(direction) => moveLayer(layer.id, direction)}
          />
        ))}
      </ul>

      {active && (
        <div className="well flex flex-col gap-3 rounded-[12px] px-2.5 py-2.5">
          <Slider
            label="Layer opacity"
            value={active.opacity}
            min={0}
            max={100}
            unit="%"
            width="w-full"
            onChange={(value) => setLayerOpacity(active.id, value)}
          />
          <Select
            label="Blend mode"
            value={active.blendMode}
            options={OPTION_DEFS.blendMode.options}
            onChange={(value) => setLayerBlend(active.id, value)}
            width="w-full"
          />
        </div>
      )}
    </div>
  )
}

function LayerRow({ layer, active, onSelect, onToggleVisible, onToggleLock, onRename, onMove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(layer.name)

  // Always start from the source of truth when editing begins.
  useEffect(() => {
    if (!editing) setDraft(layer.name)
  }, [editing, layer.name])

  const commit = () => {
    const next = draft.trim()
    if (next) onRename(next)
    else setDraft(layer.name)
    setEditing(false)
  }

  return (
    <li
      className={cn(
        'group flex items-center gap-2 rounded-[11px] border px-1.5 py-1.5 transition-colors duration-150',
        active
          ? 'border-aurora-violet/55 bg-aurora-violet/[0.13]'
          : 'border-transparent hover:border-white/10 hover:bg-white/[0.045]',
      )}
    >
      {/* Visibility — the eye sits first because it is scanned most often. */}
      <IconButton
        icon={layer.visible ? 'eye' : 'eyeOff'}
        label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
        size="xs"
        tone="neutral"
        active={layer.visible}
        onClick={onToggleVisible}
      />

      {/* Thumbnail: recognition over recall — you pick layers by eye. */}
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={() => setEditing(true)}
        aria-pressed={active}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-[9px] py-0.5 text-left"
      >
        <span
          className="checkerboard grid h-8 w-11 shrink-0 place-items-center overflow-hidden rounded-[7px] border border-white/20"
          aria-hidden="true"
        >
          <span
            className={cn(
              'h-6 w-9 rounded-[5px]',
              !layer.visible && 'opacity-20',
            )}
            style={{
              // Placeholder thumbnail tinted by stack position; real thumbnails
              // generated from layer pixels come in the polish pass.
              background: `linear-gradient(135deg, hsl(${(layer.index ?? 0) * 67 % 360} 72% 56%), hsl(${((layer.index ?? 0) * 67 + 45) % 360} 72% 44%))`,
            }}
          />
        </span>

        <span className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit()
                if (event.key === 'Escape') {
                  setDraft(layer.name)
                  setEditing(false)
                }
              }}
              className="w-full rounded-[6px] bg-white/10 px-1 py-0.5 text-[11.5px] text-fg outline-none"
            />
          ) : (
            <span className="block truncate text-[11.5px] font-medium text-fg">
              {layer.name}
            </span>
          )}
          <span className="block truncate font-mono text-[9.5px] text-fg-subtle">
            {layer.meta} · {layer.opacity}%
          </span>
        </span>
      </button>

      {/* Reorder: buttons, not drag-and-drop — keyboard reachable and
          discoverable, with drag as a later nicety. */}
      <IconButton
        icon="chevronDown"
        label={`Move ${layer.name} up`}
        size="xs"
        tone="neutral"
        className="rotate-180"
        onClick={() => onMove(-1)}
      />
      <IconButton
        icon="chevronDown"
        label={`Move ${layer.name} down`}
        size="xs"
        tone="neutral"
        onClick={() => onMove(1)}
      />

      <IconButton
        icon={layer.locked ? 'lock' : 'unlock'}
        label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
        size="xs"
        tone="neutral"
        active={layer.locked}
        onClick={onToggleLock}
      />
    </li>
  )
}