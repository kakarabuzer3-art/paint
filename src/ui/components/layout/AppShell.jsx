import TopBar from './TopBar.jsx'
import LeftToolRail from './LeftToolRail.jsx'
import OptionsBar from './OptionsBar.jsx'
import RightInspector from './RightInspector.jsx'
import StatusBar from './StatusBar.jsx'
import CanvasStage from '../canvas/CanvasStage.jsx'

/**
 * Application frame.
 *
 * Structure mirrors the classic editor layout so users transfer knowledge
 * instantly (recognition over recall): document + actions across the top,
 * tools down the left, contextual options under the top bar, inspector on
 * the right, status across the bottom — with the canvas owning the largest,
 * brightest area in the middle.
 *
 * Every region is `min-h-0` / `min-w-0` so flex children can shrink; without
 * those a single long label would break the whole grid.
 */
export default function AppShell() {
  return (
    <div className="relative z-10 flex h-full flex-col gap-2 p-2 sm:gap-2.5 sm:p-2.5">
      {/*
        Skip link. The shell is one long row of icon buttons and sliders, so a
        keyboard user would otherwise have to Tab through every control to
        reach the artwork. `sr-only` until focused, then it becomes a real
        target above the top bar.
      */}
      <a
        href="#canvas-stage"
        className="sr-only rounded-[10px] bg-aurora-violet px-3 py-2 text-[13px] font-medium text-white focus:not-sr-only focus:absolute focus:left-2.5 focus:top-2.5 focus:z-50"
      >
        Skip to canvas
      </a>

      <TopBar />

      <div className="flex min-h-0 flex-1 gap-2 sm:gap-2.5">
        <LeftToolRail />

        <main className="flex min-w-0 flex-1 flex-col gap-2 sm:gap-2.5">
          <OptionsBar />
          <CanvasStage />
        </main>

        <RightInspector />
      </div>

      <StatusBar />
    </div>
  )
}