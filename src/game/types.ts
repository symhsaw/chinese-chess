export type Color = 'red' | 'black'
export type PieceType = 'general' | 'advisor' | 'elephant' | 'horse' | 'chariot' | 'cannon' | 'soldier'

export interface Position {
  row: number
  col: number
}

export interface Piece {
  id: string
  color: Color
  type: PieceType
}

export type Board = Array<Array<Piece | null>>

export interface Move {
  from: Position
  to: Position
}

export interface MoveRecord extends Move {
  piece: Piece
  captured: Piece | null
  notation: string
}

export type GameResult =
  | { status: 'playing' }
  | { status: 'win'; winner: Color; reason: 'checkmate' | 'stalemate' | 'general-captured' }
  | { status: 'draw'; reason: 'repetition' }

export interface GameState {
  board: Board
  turn: Color
  history: MoveRecord[]
  lastMove: Move | null
  positionCounts: Record<string, number>
  result: GameResult
}

export type Difficulty = 'easy' | 'medium' | 'hard'
