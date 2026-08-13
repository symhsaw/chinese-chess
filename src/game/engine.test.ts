import { describe, expect, it } from 'vitest'
import { applyMove, createInitialBoard, createInitialState, getAllLegalMoves, getLegalMovesForPiece, getPseudoMoves, isInCheck, moveBoard, positionKey } from './engine'
import type { Board, GameState, Piece, PieceType } from './types'

const emptyBoard = (): Board => Array.from({ length: 10 }, () => Array<Piece | null>(9).fill(null))
const piece = (color: 'red' | 'black', type: PieceType): Piece => ({ id: `${color}-${type}`, color, type })
const has = (moves: ReturnType<typeof getPseudoMoves>, row: number, col: number) => moves.some((move) => move.row === row && move.col === col)

describe('initial position', () => {
  it('has 32 pieces and red moves first', () => {
    const state = createInitialState()
    expect(state.board.flat().filter(Boolean)).toHaveLength(32)
    expect(state.turn).toBe('red')
    expect(getAllLegalMoves(state.board, 'red').length).toBeGreaterThan(0)
  })
})

describe('piece movement', () => {
  it('restricts generals and advisors to the palace', () => {
    const board = emptyBoard()
    board[9][4] = piece('red', 'general')
    board[0][3] = piece('black', 'general')
    expect(has(getPseudoMoves(board, { row: 9, col: 4 }), 9, 3)).toBe(true)
    expect(has(getPseudoMoves(board, { row: 9, col: 4 }), 9, 5)).toBe(true)
    expect(has(getPseudoMoves(board, { row: 9, col: 4 }), 8, 4)).toBe(true)
    board[9][3] = piece('red', 'advisor')
    expect(has(getPseudoMoves(board, { row: 9, col: 3 }), 8, 2)).toBe(false)
  })

  it('blocks an elephant eye and prevents crossing the river', () => {
    const board = emptyBoard()
    board[9][2] = piece('red', 'elephant')
    expect(has(getPseudoMoves(board, { row: 9, col: 2 }), 7, 4)).toBe(true)
    board[8][3] = piece('red', 'soldier')
    expect(has(getPseudoMoves(board, { row: 9, col: 2 }), 7, 4)).toBe(false)
    board[5][2] = piece('red', 'elephant')
    expect(has(getPseudoMoves(board, { row: 5, col: 2 }), 3, 4)).toBe(false)
  })

  it('blocks a horse at its leg', () => {
    const board = emptyBoard()
    board[5][4] = piece('red', 'horse')
    expect(has(getPseudoMoves(board, { row: 5, col: 4 }), 3, 3)).toBe(true)
    board[4][4] = piece('red', 'soldier')
    expect(has(getPseudoMoves(board, { row: 5, col: 4 }), 3, 3)).toBe(false)
    expect(has(getPseudoMoves(board, { row: 5, col: 4 }), 3, 5)).toBe(false)
  })

  it('requires exactly one cannon screen to capture', () => {
    const board = emptyBoard()
    board[5][4] = piece('red', 'cannon')
    board[3][4] = piece('red', 'soldier')
    board[1][4] = piece('black', 'horse')
    expect(has(getPseudoMoves(board, { row: 5, col: 4 }), 4, 4)).toBe(true)
    expect(has(getPseudoMoves(board, { row: 5, col: 4 }), 2, 4)).toBe(false)
    expect(has(getPseudoMoves(board, { row: 5, col: 4 }), 1, 4)).toBe(true)
  })

  it('lets soldiers move sideways only after crossing the river', () => {
    const board = emptyBoard()
    board[6][4] = piece('red', 'soldier')
    expect(has(getPseudoMoves(board, { row: 6, col: 4 }), 6, 3)).toBe(false)
    board[4][4] = piece('red', 'soldier')
    expect(has(getPseudoMoves(board, { row: 4, col: 4 }), 4, 3)).toBe(true)
    expect(has(getPseudoMoves(board, { row: 4, col: 4 }), 5, 4)).toBe(false)
  })

  it('lets a chariot slide and stops after capture', () => {
    const board = emptyBoard()
    board[5][4] = piece('red', 'chariot')
    board[2][4] = piece('black', 'horse')
    expect(has(getPseudoMoves(board, { row: 5, col: 4 }), 2, 4)).toBe(true)
    expect(has(getPseudoMoves(board, { row: 5, col: 4 }), 1, 4)).toBe(false)
  })
})

describe('check and game state', () => {
  it('detects flying generals and disallows exposing them', () => {
    const board = emptyBoard()
    board[0][4] = piece('black', 'general')
    board[9][4] = piece('red', 'general')
    board[5][4] = piece('red', 'chariot')
    expect(isInCheck(board, 'red')).toBe(false)
    const sideways = getLegalMovesForPiece(board, { row: 5, col: 4 })
    expect(sideways.some((move) => move.to.row === 5 && move.to.col === 3)).toBe(false)
    expect(isInCheck(moveBoard(board, { from: { row: 5, col: 4 }, to: { row: 5, col: 3 } }), 'red')).toBe(true)
  })

  it('rejects a move outside a piece movement pattern', () => {
    const state = createInitialState()
    const unchanged = applyMove(state, { from: { row: 9, col: 4 }, to: { row: 7, col: 4 } })
    expect(unchanged).toBe(state)
  })

  it('records captures and switches turns', () => {
    const state = createInitialState()
    const moved = applyMove(state, { from: { row: 6, col: 0 }, to: { row: 5, col: 0 } })
    expect(moved.turn).toBe('black')
    expect(moved.history).toHaveLength(1)
    expect(moved.lastMove?.to).toEqual({ row: 5, col: 0 })
  })

  it('starts from the canonical back ranks', () => {
    const board = createInitialBoard()
    expect(board[0].map((item) => item?.type)).toEqual(['chariot', 'horse', 'elephant', 'advisor', 'general', 'advisor', 'elephant', 'horse', 'chariot'])
  })

  it('distinguishes checkmate from stalemate', () => {
    const board = emptyBoard()
    board[9][4] = piece('red', 'general')
    board[0][4] = piece('black', 'general')
    board[8][3] = piece('black', 'chariot')
    board[8][5] = piece('black', 'chariot')
    board[5][4] = piece('black', 'soldier')
    expect(isInCheck(board, 'red')).toBe(false)
    expect(getAllLegalMoves(board, 'red')).toHaveLength(0)

    board[5][4] = piece('black', 'chariot')
    expect(isInCheck(board, 'red')).toBe(true)
    expect(getAllLegalMoves(board, 'red')).toHaveLength(0)
  })

  it('declares a draw on the third occurrence of a position', () => {
    const state = createInitialState()
    const move = { from: { row: 6, col: 0 }, to: { row: 5, col: 0 } }
    const repeatedBoard = moveBoard(state.board, move)
    const key = positionKey(repeatedBoard, 'black')
    const repeatedState: GameState = { ...state, positionCounts: { ...state.positionCounts, [key]: 2 } }
    expect(applyMove(repeatedState, move).result).toEqual({ status: 'draw', reason: 'repetition' })
  })
})
