import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyMove, createInitialState, getLegalMovesForPiece, isInCheck, samePosition } from './game/engine'
import type { Color, Difficulty, GameState, Move, Piece, Position } from './game/types'
import { playTone } from './audio'

const GLYPHS: Record<Color, Record<Piece['type'], string>> = {
  red: { general: '帥', advisor: '仕', elephant: '相', horse: '傌', chariot: '俥', cannon: '炮', soldier: '兵' },
  black: { general: '將', advisor: '士', elephant: '象', horse: '馬', chariot: '車', cannon: '砲', soldier: '卒' },
}

const NAMES: Record<Piece['type'], string> = {
  general: 'general', advisor: 'advisor', elephant: 'elephant', horse: 'horse', chariot: 'chariot', cannon: 'cannon', soldier: 'soldier',
}

function cellStyle(row: number, col: number) {
  return { left: `${((col * 100 + 50) / 900) * 100}%`, top: `${((row * 100 + 50) / 1000) * 100}%` }
}

function statusText(state: GameState, thinking: boolean) {
  if (state.result.status === 'draw') return 'Draw by threefold repetition'
  if (state.result.status === 'win') {
    const reason = state.result.reason === 'general-captured' ? 'the general fell' : state.result.reason
    return `${state.result.winner === 'red' ? 'Red' : 'Black'} wins by ${reason}`
  }
  if (thinking) return 'Black is considering the position…'
  if (isInCheck(state.board, state.turn)) return `${state.turn === 'red' ? 'Red' : 'Black'} is in check`
  return state.turn === 'red' ? 'Your move' : 'Black to move'
}

function BoardLines() {
  return (
    <svg className="board-lines" viewBox="0 0 900 1000" aria-hidden="true">
      <rect className="line heavy" x="50" y="50" width="800" height="900" />
      {Array.from({ length: 10 }, (_, i) => <line className="line" key={`h${i}`} x1="50" y1={50 + i * 100} x2="850" y2={50 + i * 100} />)}
      {[0, 8].map((i) => <line className="line" key={`v${i}`} x1={50 + i * 100} y1="50" x2={50 + i * 100} y2="950" />)}
      {Array.from({ length: 7 }, (_, index) => index + 1).map((i) => (
        <g key={`v${i}`}><line className="line" x1={50 + i * 100} y1="50" x2={50 + i * 100} y2="450" /><line className="line" x1={50 + i * 100} y1="550" x2={50 + i * 100} y2="950" /></g>
      ))}
      <path className="line" d="M350 50L550 250M550 50L350 250M350 750L550 950M550 750L350 950" />
    </svg>
  )
}

interface BoardProps {
  state: GameState
  selected: Position | null
  legal: Move[]
  disabled: boolean
  onPoint: (position: Position) => void
}

function GameBoard({ state, selected, legal, disabled, onPoint }: BoardProps) {
  return (
    <div className={`board ${isInCheck(state.board, state.turn) ? 'board-check' : ''}`} aria-label="Chinese chess board">
      <BoardLines />
      {state.board.map((row, rowIndex) => row.map((piece, colIndex) => {
        const pos = { row: rowIndex, col: colIndex }
        const isSelected = selected && samePosition(selected, pos)
        const legalMove = legal.find((move) => samePosition(move.to, pos))
        const isLast = state.lastMove && (samePosition(state.lastMove.from, pos) || samePosition(state.lastMove.to, pos))
        const label = piece ? `${piece.color} ${NAMES[piece.type]} at ${String.fromCharCode(97 + colIndex)}${10 - rowIndex}` : `empty ${String.fromCharCode(97 + colIndex)}${10 - rowIndex}`
        return (
          <button
            className={`point ${piece ? 'occupied' : ''} ${isSelected ? 'selected' : ''} ${legalMove ? 'legal' : ''} ${legalMove && piece ? 'capture' : ''} ${isLast ? 'last' : ''}`}
            style={cellStyle(rowIndex, colIndex)}
            key={`${rowIndex}-${colIndex}`}
            onClick={() => onPoint(pos)}
            disabled={disabled && !piece}
            aria-label={label}
            aria-pressed={Boolean(isSelected)}
          >
            {piece && <span className={`piece ${piece.color}`}>{GLYPHS[piece.color][piece.type]}</span>}
            {legalMove && !piece && <span className="move-dot" />}
          </button>
        )
      }))}
    </div>
  )
}

function Captures({ state }: { state: GameState }) {
  const captured = state.history.map((move) => move.captured).filter((piece): piece is Piece => Boolean(piece))
  return (
    <div className="captures" aria-label="Captured pieces">
      {captured.length ? captured.map((piece, index) => <span className={`mini-piece ${piece.color}`} key={`${piece.id}-${index}`}>{GLYPHS[piece.color][piece.type]}</span>) : <span className="empty-copy">No captures yet</span>}
    </div>
  )
}

export default function App() {
  const [timeline, setTimeline] = useState<GameState[]>([createInitialState()])
  const [selected, setSelected] = useState<Position | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [thinking, setThinking] = useState(false)
  const [sound, setSound] = useState(true)
  const workerRef = useRef<Worker | null>(null)
  const state = timeline[timeline.length - 1]
  const legal = useMemo(() => selected ? getLegalMovesForPiece(state.board, selected) : [], [selected, state.board])

  const announceTone = useCallback((before: GameState, after: GameState) => {
    if (!sound) return
    const last = after.history.at(-1)
    if (after.result.status !== 'playing') playTone('end')
    else if (isInCheck(after.board, after.turn)) playTone('check')
    else playTone(last?.captured ? 'capture' : 'move')
  }, [sound])

  useEffect(() => {
    workerRef.current = new Worker(new URL('./game/ai.worker.ts', import.meta.url), { type: 'module' })
    return () => workerRef.current?.terminate()
  }, [])

  useEffect(() => {
    if (state.turn !== 'black' || state.result.status !== 'playing' || thinking) return
    const worker = workerRef.current
    if (!worker) return
    setThinking(true)
    worker.onmessage = (event: MessageEvent<Move | null>) => {
      setThinking(false)
      if (!event.data) return
      setTimeline((current) => {
        const before = current[current.length - 1]
        if (before.turn !== 'black' || before.result.status !== 'playing') return current
        const after = applyMove(before, event.data!, false)
        announceTone(before, after)
        return [...current, after]
      })
    }
    worker.postMessage({ state, difficulty })
  }, [announceTone, difficulty, state, thinking])

  const handlePoint = (position: Position) => {
    if (thinking || state.turn !== 'red' || state.result.status !== 'playing') return
    const piece = state.board[position.row][position.col]
    if (selected) {
      const move = legal.find((candidate) => samePosition(candidate.to, position))
      if (move) {
        const after = applyMove(state, move)
        announceTone(state, after)
        setTimeline((current) => [...current, after])
        setSelected(null)
        return
      }
    }
    setSelected(piece?.color === 'red' ? position : null)
  }

  const restart = (nextDifficulty = difficulty) => {
    if (state.history.length && !window.confirm('Start a new game? Your current game will be lost.')) return false
    workerRef.current?.terminate()
    workerRef.current = new Worker(new URL('./game/ai.worker.ts', import.meta.url), { type: 'module' })
    setThinking(false)
    setSelected(null)
    setDifficulty(nextDifficulty)
    setTimeline([createInitialState()])
    return true
  }

  const changeDifficulty = (next: Difficulty) => {
    if (next === difficulty) return
    if (!state.history.length || restart(next)) setDifficulty(next)
  }

  const undo = () => {
    if (thinking || timeline.length <= 1) return
    const remove = state.turn === 'red' ? Math.min(2, timeline.length - 1) : 1
    setTimeline((current) => current.slice(0, Math.max(1, current.length - remove)))
    setSelected(null)
  }

  return (
    <main className="app-shell">
      <header className="masthead">
        <div className="seal" aria-hidden="true">弈</div>
        <div><p className="eyebrow">A game across the river</p><h1>Jade River</h1></div>
        <div className="header-controls">
          <button className="icon-button" onClick={() => setSound((value) => !value)} aria-label={sound ? 'Mute sounds' : 'Enable sounds'}>{sound ? '♪' : '♪̸'}</button>
          <button className="text-button" onClick={() => restart()}>New game</button>
        </div>
      </header>

      <section className="game-layout">
        <aside className="side-panel player-panel black-panel">
          <span className="turn-dot black-dot" /><div><span className="panel-label">Opponent</span><strong>Black · Computer</strong></div>
          {thinking && <span className="thinking-dots" aria-label="Computer thinking"><i /><i /><i /></span>}
        </aside>

        <div className="board-column">
          <div className="status-ribbon" role="status" aria-live="polite"><span>{statusText(state, thinking)}</span><small>{state.history.length ? `Move ${Math.ceil(state.history.length / 2)}` : 'Red moves first'}</small></div>
          <GameBoard state={state} selected={selected} legal={legal} disabled={thinking || state.turn !== 'red'} onPoint={handlePoint} />
          <div className="mobile-actions"><button onClick={undo} disabled={thinking || timeline.length <= 1}>Undo turn</button><button onClick={() => restart()}>Restart</button></div>
        </div>

        <aside className="control-panel">
          <section><p className="section-kicker">Match</p><h2>Game controls</h2>
            <label className="select-label">Difficulty
              <select value={difficulty} onChange={(event) => changeDifficulty(event.target.value as Difficulty)}>
                <option value="easy">Easy · Apprentice</option><option value="medium">Medium · Scholar</option><option value="hard">Hard · Master</option>
              </select>
            </label>
            <div className="button-row"><button onClick={undo} disabled={thinking || timeline.length <= 1}>↶ Undo turn</button><button onClick={() => restart()}>↻ Restart</button></div>
          </section>
          <section><div className="section-heading"><p className="section-kicker">Captured</p><span>{state.history.filter((move) => move.captured).length}</span></div><Captures state={state} /></section>
          <section className="history-section"><div className="section-heading"><p className="section-kicker">Move record</p><span>{state.history.length}</span></div>
            <ol className="history-list">{state.history.length ? state.history.map((move, index) => <li key={index}><b>{index + 1}</b><span>{move.notation}</span></li>) : <li className="empty-copy">The record is waiting for the first move.</li>}</ol>
          </section>
        </aside>

        <aside className="side-panel player-panel red-panel">
          <span className="turn-dot red-dot" /><div><span className="panel-label">You</span><strong>Red · First move</strong></div>
        </aside>
      </section>
      <footer><span>楚河 · 漢界</span><p>Select a piece, then choose a highlighted intersection.</p></footer>
    </main>
  )
}
