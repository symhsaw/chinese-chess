import type { Board, Color, GameState, Move, MoveRecord, Piece, PieceType, Position } from './types'

export const ROWS = 10
export const COLS = 9
export const opposite = (color: Color): Color => (color === 'red' ? 'black' : 'red')
export const samePosition = (a: Position, b: Position) => a.row === b.row && a.col === b.col
const inside = ({ row, col }: Position) => row >= 0 && row < ROWS && col >= 0 && col < COLS

const makePiece = (color: Color, type: PieceType, index: number): Piece => ({ id: `${color}-${type}-${index}`, color, type })

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: ROWS }, () => Array<Piece | null>(COLS).fill(null))
  const back: PieceType[] = ['chariot', 'horse', 'elephant', 'advisor', 'general', 'advisor', 'elephant', 'horse', 'chariot']
  back.forEach((type, col) => {
    board[0][col] = makePiece('black', type, col)
    board[9][col] = makePiece('red', type, col)
  })
  board[2][1] = makePiece('black', 'cannon', 0)
  board[2][7] = makePiece('black', 'cannon', 1)
  board[7][1] = makePiece('red', 'cannon', 0)
  board[7][7] = makePiece('red', 'cannon', 1)
  ;[0, 2, 4, 6, 8].forEach((col, index) => {
    board[3][col] = makePiece('black', 'soldier', index)
    board[6][col] = makePiece('red', 'soldier', index)
  })
  return board
}

export function positionKey(board: Board, turn: Color): string {
  const codes: Record<PieceType, string> = { general: 'g', advisor: 'a', elephant: 'e', horse: 'h', chariot: 'r', cannon: 'c', soldier: 's' }
  return `${turn}|${board.flat().map((piece) => piece ? `${piece.color[0]}${codes[piece.type]}` : '..').join('')}`
}

export function createInitialState(): GameState {
  const board = createInitialBoard()
  const key = positionKey(board, 'red')
  return { board, turn: 'red', history: [], lastMove: null, positionCounts: { [key]: 1 }, result: { status: 'playing' } }
}

function palaceContains(color: Color, pos: Position): boolean {
  return pos.col >= 3 && pos.col <= 5 && (color === 'red' ? pos.row >= 7 && pos.row <= 9 : pos.row >= 0 && pos.row <= 2)
}

function pushIfAvailable(board: Board, piece: Piece, moves: Position[], pos: Position) {
  if (inside(pos) && board[pos.row][pos.col]?.color !== piece.color) moves.push(pos)
}

export function getPseudoMoves(board: Board, from: Position): Position[] {
  const piece = board[from.row]?.[from.col]
  if (!piece) return []
  const moves: Position[] = []

  if (piece.type === 'general') {
    const steps = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    steps.forEach(([dr, dc]) => {
      const to = { row: from.row + dr, col: from.col + dc }
      if (palaceContains(piece.color, to)) pushIfAvailable(board, piece, moves, to)
    })
    for (const direction of [-1, 1]) {
      for (let row = from.row + direction; row >= 0 && row < ROWS; row += direction) {
        const target = board[row][from.col]
        if (target) {
          if (target.type === 'general' && target.color !== piece.color) moves.push({ row, col: from.col })
          break
        }
      }
    }
  }

  if (piece.type === 'advisor') {
    ;[[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => {
      const to = { row: from.row + dr, col: from.col + dc }
      if (palaceContains(piece.color, to)) pushIfAvailable(board, piece, moves, to)
    })
  }

  if (piece.type === 'elephant') {
    ;[[-2, -2], [-2, 2], [2, -2], [2, 2]].forEach(([dr, dc]) => {
      const to = { row: from.row + dr, col: from.col + dc }
      const eye = { row: from.row + dr / 2, col: from.col + dc / 2 }
      const ownSide = piece.color === 'red' ? to.row >= 5 : to.row <= 4
      if (inside(to) && ownSide && !board[eye.row][eye.col]) pushIfAvailable(board, piece, moves, to)
    })
  }

  if (piece.type === 'horse') {
    const jumps = [
      [-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0],
      [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1],
    ]
    jumps.forEach(([dr, dc, lr, lc]) => {
      const to = { row: from.row + dr, col: from.col + dc }
      const leg = { row: from.row + lr, col: from.col + lc }
      if (inside(to) && !board[leg.row][leg.col]) pushIfAvailable(board, piece, moves, to)
    })
  }

  if (piece.type === 'chariot' || piece.type === 'cannon') {
    ;[[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
      let screened = false
      for (let row = from.row + dr, col = from.col + dc; inside({ row, col }); row += dr, col += dc) {
        const target = board[row][col]
        if (piece.type === 'chariot') {
          if (!target) moves.push({ row, col })
          else {
            if (target.color !== piece.color) moves.push({ row, col })
            break
          }
        } else if (!screened) {
          if (!target) moves.push({ row, col })
          else screened = true
        } else if (target) {
          if (target.color !== piece.color) moves.push({ row, col })
          break
        }
      }
    })
  }

  if (piece.type === 'soldier') {
    const forward = piece.color === 'red' ? -1 : 1
    pushIfAvailable(board, piece, moves, { row: from.row + forward, col: from.col })
    const crossed = piece.color === 'red' ? from.row <= 4 : from.row >= 5
    if (crossed) {
      pushIfAvailable(board, piece, moves, { row: from.row, col: from.col - 1 })
      pushIfAvailable(board, piece, moves, { row: from.row, col: from.col + 1 })
    }
  }
  return moves
}

export function findGeneral(board: Board, color: Color): Position | null {
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const piece = board[row][col]
    if (piece?.type === 'general' && piece.color === color) return { row, col }
  }
  return null
}

export function isInCheck(board: Board, color: Color): boolean {
  const general = findGeneral(board, color)
  if (!general) return true
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const piece = board[row][col]
    if (piece && piece.color !== color && getPseudoMoves(board, { row, col }).some((to) => samePosition(to, general))) return true
  }
  return false
}

export function moveBoard(board: Board, move: Move): Board {
  const next = board.map((row) => [...row])
  next[move.to.row][move.to.col] = next[move.from.row][move.from.col]
  next[move.from.row][move.from.col] = null
  return next
}

export function getLegalMovesForPiece(board: Board, from: Position): Move[] {
  const piece = board[from.row]?.[from.col]
  if (!piece) return []
  return getPseudoMoves(board, from)
    .map((to) => ({ from, to }))
    .filter((move) => !isInCheck(moveBoard(board, move), piece.color))
}

export function getAllLegalMoves(board: Board, color: Color): Move[] {
  const moves: Move[] = []
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    if (board[row][col]?.color === color) moves.push(...getLegalMovesForPiece(board, { row, col }))
  }
  return moves
}

const fileNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']
export function moveNotation(piece: Piece, move: Move, captured: Piece | null): string {
  const names: Record<PieceType, string> = { general: 'General', advisor: 'Advisor', elephant: 'Elephant', horse: 'Horse', chariot: 'Chariot', cannon: 'Cannon', soldier: 'Soldier' }
  return `${names[piece.type]} ${fileNames[move.from.col]}${10 - move.from.row}–${fileNames[move.to.col]}${10 - move.to.row}${captured ? ' ×' : ''}`
}

export function applyMove(state: GameState, move: Move, validate = true): GameState {
  if (state.result.status !== 'playing') return state
  const piece = state.board[move.from.row]?.[move.from.col]
  if (!piece || piece.color !== state.turn) return state
  if (validate && !getLegalMovesForPiece(state.board, move.from).some((candidate) => samePosition(candidate.to, move.to))) return state
  const captured = state.board[move.to.row][move.to.col]
  const board = moveBoard(state.board, move)
  const record: MoveRecord = { ...move, piece, captured, notation: moveNotation(piece, move, captured) }
  const turn = opposite(state.turn)
  const key = positionKey(board, turn)
  const positionCounts = { ...state.positionCounts, [key]: (state.positionCounts[key] ?? 0) + 1 }
  let result: GameState['result'] = { status: 'playing' }
  if (captured?.type === 'general') result = { status: 'win', winner: piece.color, reason: 'general-captured' }
  else if (positionCounts[key] >= 3) result = { status: 'draw', reason: 'repetition' }
  else {
    const replies = getAllLegalMoves(board, turn)
    if (replies.length === 0) result = { status: 'win', winner: piece.color, reason: isInCheck(board, turn) ? 'checkmate' : 'stalemate' }
  }
  return { board, turn, history: [...state.history, record], lastMove: move, positionCounts, result }
}
