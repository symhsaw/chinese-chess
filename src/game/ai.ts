import { applyMove, getAllLegalMoves, isInCheck, moveBoard, opposite } from './engine'
import type { Board, Color, Difficulty, GameState, Move, PieceType } from './types'

const VALUES: Record<PieceType, number> = {
  general: 100_000,
  chariot: 900,
  cannon: 450,
  horse: 420,
  elephant: 220,
  advisor: 220,
  soldier: 100,
}

const PROFILE: Record<Difficulty, { depth: number; time: number; randomness: number }> = {
  easy: { depth: 1, time: 180, randomness: 0.45 },
  medium: { depth: 2, time: 650, randomness: 0.08 },
  hard: { depth: 4, time: 1400, randomness: 0 },
}

function positional(piece: NonNullable<Board[number][number]>, row: number, col: number): number {
  const center = 4 - Math.abs(4 - col)
  if (piece.type === 'soldier') {
    const progress = piece.color === 'red' ? 9 - row : row
    return progress * 8 + center * 2
  }
  if (piece.type === 'horse' || piece.type === 'cannon') return center * 5
  if (piece.type === 'general') return -Math.abs(4 - col) * 3
  return center
}

export function evaluateBoard(board: Board, perspective: Color): number {
  let score = 0
  for (let row = 0; row < board.length; row++) for (let col = 0; col < board[row].length; col++) {
    const piece = board[row][col]
    if (!piece) continue
    const value = VALUES[piece.type] + positional(piece, row, col)
    score += piece.color === perspective ? value : -value
  }
  if (isInCheck(board, opposite(perspective))) score += 35
  if (isInCheck(board, perspective)) score -= 45
  return score
}

function moveOrder(board: Board, moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    const capturedA = board[a.to.row][a.to.col]
    const capturedB = board[b.to.row][b.to.col]
    return (capturedB ? VALUES[capturedB.type] : 0) - (capturedA ? VALUES[capturedA.type] : 0)
  })
}

function search(
  board: Board,
  turn: Color,
  perspective: Color,
  depth: number,
  alpha: number,
  beta: number,
  deadline: number,
): number {
  if (performance.now() >= deadline) throw new Error('deadline')
  const moves = getAllLegalMoves(board, turn)
  if (moves.length === 0) return turn === perspective ? -99_000 - depth : 99_000 + depth
  if (depth === 0) {
    const mobility = getAllLegalMoves(board, perspective).length - getAllLegalMoves(board, opposite(perspective)).length
    return evaluateBoard(board, perspective) + mobility * 2
  }
  const maximizing = turn === perspective
  let best = maximizing ? -Infinity : Infinity
  for (const move of moveOrder(board, moves)) {
    const score = search(moveBoard(board, move), opposite(turn), perspective, depth - 1, alpha, beta, deadline)
    if (maximizing) {
      best = Math.max(best, score)
      alpha = Math.max(alpha, best)
    } else {
      best = Math.min(best, score)
      beta = Math.min(beta, best)
    }
    if (beta <= alpha) break
  }
  return best
}

export function chooseAiMove(state: GameState, difficulty: Difficulty): Move | null {
  const moves = moveOrder(state.board, getAllLegalMoves(state.board, state.turn))
  if (!moves.length) return null
  const profile = PROFILE[difficulty]
  const deadline = performance.now() + profile.time
  let ranked = moves.map((move) => ({ move, score: evaluateBoard(moveBoard(state.board, move), state.turn) }))

  for (let depth = 1; depth <= profile.depth; depth++) {
    const nextRanked: typeof ranked = []
    try {
      for (const move of moves) {
        const board = moveBoard(state.board, move)
        const score = search(board, opposite(state.turn), state.turn, depth - 1, -Infinity, Infinity, deadline)
        nextRanked.push({ move, score })
      }
      ranked = nextRanked.sort((a, b) => b.score - a.score)
    } catch {
      break
    }
  }

  if (profile.randomness > 0 && Math.random() < profile.randomness) {
    const pool = ranked.slice(0, Math.min(difficulty === 'easy' ? 5 : 3, ranked.length))
    return pool[Math.floor(Math.random() * pool.length)].move
  }
  return ranked[0].move
}

export function previewAiMove(state: GameState, difficulty: Difficulty): GameState {
  const move = chooseAiMove(state, difficulty)
  return move ? applyMove(state, move, false) : state
}
