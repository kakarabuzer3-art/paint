import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import Kbd from '../common/Kbd.jsx'
import Tooltip from '../common/Tooltip.jsx'
import IconButton from '../common/IconButton.jsx'
import OptionControl from '../options/OptionControl.jsx'
import { TOOLS } from '../../data/tools.js'
import { useUi } from '../../state/context.js'

/**
 * Contextual options bar — the primary expression of progressive disclosure.
 *
 * Only the active tool's controls render, so the user is never shown a
 * setting that cannot affect what they are doing right now. Everything swaps
 * in place without moving the canvas (no layout shift under the cursor).
 */
export default function OptionsBar() {
  const { activeTool, options, setOption, resetOptions, panels } = useUi()

  if (!panels.options) return null

  const tool = TOOLS[activeTool]
  const hasOptions = tool.options.length > 0

  return (
    <div
      className="glass-2 glass-specular flex shrink-0 items-center gap-3 overflow-x-auto rounded-[var(--radius-panel)] px-2.5 py-1.5 scroll-slim"
      aria-label={`${tool.label} options`}
    >
      {/* Active tool identity — always visible so the user knows which tool
          these settings belong to. */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-aurora-violet/20 text-fg">
          <Icon name={tool.icon} size={15} />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-[11.5px] font-semibold tracking-tight text-fg">{tool.label}</span>
          <span className="hidden items-center gap-1 text-[9.5px] text-fg-subtle md:flex">
            press <Kbd size="sm">{tool.shortcut?.toUpperCase()}</Kbd> to switch
          </span>
        </div>
      </div>

      <span className="h-7 w-px shrink-0 bg-white/10" />

      {hasOptions ? (
        <div className="flex min-w-0 items-end gap-4">
          {tool.options.map((optionId, index) => (
            <div key={optionId} className="contents">
              {index > 0 && <span className="h-7 w-px shrink-0 self-center bg-white/[0.07]" />}
              <OptionControl
                id={optionId}
                value={options[optionId]}
                onChange={(value) => setOption(optionId, value)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="min-w-0 truncate text-[11px] text-fg-subtle">
          No options for this tool — {tool.hint}
        </p>
      )}

      <div className="flex-1" />

      {/* Reset returns every option to its documented default — a predictable
          escape hatch when sliders have drifted into odd territory. */}
      <Tooltip label="Reset to defaults" side="bottom">
        <span>
          <IconButton icon="rotate" label="Reset this tool's options to defaults" size="xs" onClick={resetOptions} />
        </span>
      </Tooltip>

      <p
        className={cn(
          'hidden shrink-0 items-center gap-1.5 text-[10.5px] text-fg-subtle xl:flex',
        )}
        title={tool.hint}
      >
        <Icon name="info" size={13} />
        <span className="max-w-[22ch] truncate">{tool.hint}</span>
      </p>
    </div>
  )
}