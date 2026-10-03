import { createContext, useContext } from 'react'

/**
 * Single UI context for the shell.
 *
 * Scope note: this holds *interface* state only (active tool, tool options,
 * colours, panel visibility, zoom). Pixels and layer bitmaps deliberately
 * live in the engine, never in React state — a stroke must not trigger a
 * React render. See engine/ (Phase 2) and docs in README.
 */
export const UiContext = createContext(null)

UiContext.displayName = 'AuroraUi'

/** @returns {ReturnType<typeof import('./UiProvider.jsx').useUiValueShape>} */
export function useUi() {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi() must be used inside <UiProvider>')
  return ctx
}