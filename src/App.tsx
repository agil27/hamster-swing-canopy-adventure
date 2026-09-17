import { useCallback, useEffect, useRef, useState } from 'react'
import GameCanvas from './components/GameCanvas'
import GameOverModal from './components/GameOverModal'
import Hud from './components/Hud'
import HowToPlay from './components/HowToPlay'
import PauseModal from './components/PauseModal'
import StartScreen from './components/StartScreen'
import TutorialOverlay from './components/TutorialOverlay'
import { audio } from './game/audio'
import { MUTE_KEY } from './game/constants'
import { GameEngine } from './game/engine'
import type { HudState } from './game/types'

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export default function App() {
  // One engine for the life of the page.
  const engineRef = useRef<GameEngine | null>(null)
  if (engineRef.current === null) engineRef.current = new GameEngine()
  const engine = engineRef.current

  const [hud, setHud] = useState<HudState | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showPause, setShowPause] = useState(false)
  const [muted, setMuted] = useState(readMuted)

  // Wire the engine's HUD stream into React and build the attract-mode world.
  useEffect(() => {
    engine.onHud = setHud
    engine.world.reset()
    engine.publishHud(true)
    return () => {
      engine.onHud = null
    }
  }, [engine])

  // Freeze the simulation whenever a modal is up.
  useEffect(() => {
    engine.paused = showHelp || showPause
    if (showHelp || showPause) engine.pressUp()
  }, [engine, showHelp, showPause])

  // Closing the pause modal for any reason other than "stayed paused" (i.e.
  // the phase changed under it, e.g. a game-over firing while paused isn't
  // possible today, but this keeps it from lingering into a menu/game-over).
  useEffect(() => {
    if (showPause && hud && hud.phase !== 'playing') setShowPause(false)
  }, [showPause, hud])

  useEffect(() => {
    audio.setMuted(muted)
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
    } catch {
      /* private mode — the preference just will not persist */
    }
  }, [muted])

  // Stop the music if the tab goes away, resume when it comes back.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        engine.pressUp()
        audio.stopMusic()
      } else if (engine.phase === 'playing') {
        audio.unlock()
        audio.startMusic()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [engine])

  const startRun = useCallback(() => {
    audio.unlock()
    audio.setMuted(muted)
    setShowHelp(false)
    engine.start()
  }, [engine, muted])

  const startTutorial = useCallback(() => {
    audio.unlock()
    audio.setMuted(muted)
    setShowHelp(false)
    engine.startTutorial()
  }, [engine, muted])

  const toMenu = useCallback(() => {
    audio.uiClick()
    audio.stopMusic()
    engine.toMenu()
  }, [engine])

  const toggleMute = useCallback(() => {
    audio.unlock()
    setMuted((m) => !m)
  }, [])

  const openHelp = useCallback(() => {
    audio.unlock()
    audio.uiClick()
    setShowHelp(true)
  }, [])

  const openPause = useCallback(() => {
    audio.uiClick()
    setShowPause(true)
  }, [])

  const resumeFromPause = useCallback(() => {
    audio.uiClick()
    setShowPause(false)
  }, [])

  const restartFromPause = useCallback(() => {
    setShowPause(false)
    if (engine.tutorialActive) startTutorial()
    else startRun()
  }, [engine, startRun, startTutorial])

  const menuFromPause = useCallback(() => {
    setShowPause(false)
    toMenu()
  }, [toMenu])

  const phase = hud?.phase ?? 'menu'

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0e2415]">
      <GameCanvas engine={engine} inputEnabled={phase === 'playing' && !showHelp && !showPause} />

      {hud && phase !== 'menu' && (
        <Hud hud={hud} muted={muted} onToggleMute={toggleMute} onHelp={openHelp} onPause={openPause} />
      )}

      {hud && phase === 'playing' && <TutorialOverlay hud={hud} onSkip={startRun} />}

      {showPause && (
        <PauseModal
          onResume={resumeFromPause}
          onRestart={restartFromPause}
          onMenu={menuFromPause}
          isTutorial={hud?.tutorialActive ?? false}
        />
      )}

      {phase === 'menu' && (
        <StartScreen highScore={hud?.highScore ?? 0} onPlay={startRun} onHelp={openHelp} onTutorial={startTutorial} />
      )}

      {phase === 'gameover' && hud && (
        <GameOverModal hud={hud} onRestart={startRun} onMenu={toMenu} />
      )}

      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
    </div>
  )
}
