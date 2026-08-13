/// <reference lib="webworker" />
import { chooseAiMove } from './ai'
import type { Difficulty, GameState } from './types'

self.onmessage = (event: MessageEvent<{ state: GameState; difficulty: Difficulty }>) => {
  const move = chooseAiMove(event.data.state, event.data.difficulty)
  self.postMessage(move)
}

export {}
