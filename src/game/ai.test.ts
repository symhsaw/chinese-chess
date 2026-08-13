import { describe, expect, it } from 'vitest'
import { chooseAiMove, evaluateBoard } from './ai'
import { applyMove, createInitialState, getAllLegalMoves } from './engine'

describe('computer opponent', () => {
  it('returns a legal move at every difficulty', () => {
    const redMoved = applyMove(createInitialState(), { from: { row: 6, col: 0 }, to: { row: 5, col: 0 } })
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const move = chooseAiMove(redMoved, difficulty)
      expect(move).not.toBeNull()
      expect(getAllLegalMoves(redMoved.board, 'black')).toContainEqual(move)
    }
  }, 10_000)

  it('evaluates the initial position as balanced', () => {
    const state = createInitialState()
    expect(Math.abs(evaluateBoard(state.board, 'red'))).toBeLessThan(100)
  })
})
