import { useCallback, useEffect, useRef, useState } from 'react'
import GameCanvas from './components/GameCanvas'
import GameOverModal from './components/GameOverModal'
import type { ScoreSaveStatus } from './components/GameOverModal'
import Hud from './components/Hud'
import HowToPlay from './components/HowToPlay'
import LeaderboardModal from './components/LeaderboardModal'
import PauseModal from './components/PauseModal'
import StartScreen from './components/StartScreen'
import TutorialOverlay from './components/TutorialOverlay'
import { audio } from './game/audio'
import { MUTE_KEY } from './game/constants'
import { GameEngine } from './game/engine'
import type { HudState } from './game/types'
import { submitScore } from './lib/api'
import { useAuth } from './lib/useAuth'

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
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [muted, setMuted] = useState(readMuted)
  const [saveStatus, setSaveStatus] = useState<ScoreSaveStatus>('idle')
  const auth = useAuth()

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
    engine.paused = showHelp || showPause || showLeaderboard
    if (showHelp || showPause || showLeaderboard) engine.pressUp()
  }, [engine, showHelp, showPause, showLeaderboard])

  // Closing the pause modal for any reason other than "stayed paused" (i.e.
  // the phase changed under it, e.g. a game-over firing while paused isn't
  // possible today, but this keeps it from lingering into a menu/game-over).
  useEffect(() => {
    if (showPause && hud && hud.phase !== 'playing') setShowPause(false)
  }, [showPause, hud])

  // Submit the run's score once, right as a game-over lands — reset the
  // guard the moment a new run starts so the next game-over can submit too.
  const submittedRef = useRef(false)
  useEffect(() => {
    const phase = hud?.phase ?? 'menu'
    if (phase !== 'gameover') {
      submittedRef.current = false
      return
    }
    if (submittedRef.current || !hud) return
    submittedRef.current = true
    if (!auth.user) {
      setSaveStatus('signedOut')
      return
    }
    setSaveStatus('saving')
    const { score, distance } = hud
    submitScore(score, distance)
      .then(() => setSaveStatus('saved'))
      .catch((err) => {
        // Render's free tier spins the instance down after ~15 min idle —
        // the very first request after that can time out or get refused
        // while the container wakes back up, well before it ever reaches
        // our server code (so there's nothing to see in the server's own
        // logs for it). One short retry covers that transient case without
        // the player ever needing to know; log both attempts either way so
        // a *real* failure is actually visible in the browser console.
        console.warn('[score] first save attempt failed, retrying once:', err)
        setTimeout(() => {
          submitScore(score, distance)
            .then(() => setSaveStatus('saved'))
            .catch((err2) => {
              console.error('[score] save failed after retry:', err2)
              setSaveStatus('error')
            })
        }, 2500)
      })
  }, [hud, auth.user])

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
    setSaveStatus('idle')
    engine.start()
  }, [engine, muted])

  const startTutorial = useCallback(() => {
    audio.unlock()
    audio.setMuted(muted)
    setShowHelp(false)
    setSaveStatus('idle')
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

  const openLeaderboard = useCallback(() => {
    audio.uiClick()
    setShowLeaderboard(true)
  }, [])

  const closeLeaderboard = useCallback(() => {
    audio.uiClick()
    setShowLeaderboard(false)
  }, [])

  const handleCredential = useCallback(
    (idToken: string) => {
      auth.signInWithIdToken(idToken).catch(() => {
        /* the sign-in button itself shows nothing changed; a real toast can follow if this comes up */
      })
    },
    [auth],
  )

  const handleSignOut = useCallback(() => {
    audio.uiClick()
    auth.signOut().catch(() => {})
  }, [auth])

  const handleRename = useCallback((name: string) => auth.rename(name).then(() => undefined), [auth])

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
      <GameCanvas engine={engine} inputEnabled={phase === 'playing' && !showHelp && !showPause && !showLeaderboard} />

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
        <StartScreen
          highScore={hud?.highScore ?? 0}
          onPlay={startRun}
          onHelp={openHelp}
          onTutorial={startTutorial}
          user={auth.user}
          authLoading={auth.loading}
          onCredential={handleCredential}
          onSignOut={handleSignOut}
          onRename={handleRename}
          onShowLeaderboard={openLeaderboard}
        />
      )}

      {phase === 'gameover' && hud && (
        <GameOverModal hud={hud} onRestart={startRun} onMenu={toMenu} onShowLeaderboard={openLeaderboard} saveStatus={saveStatus} />
      )}

      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}

      {showLeaderboard && <LeaderboardModal currentUserName={auth.user?.name ?? null} onClose={closeLeaderboard} />}
    </div>
  )
}
