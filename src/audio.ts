let context: AudioContext | null = null

export function playTone(kind: 'move' | 'capture' | 'check' | 'end') {
  context ??= new AudioContext()
  const now = context.currentTime
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const frequencies = { move: 360, capture: 230, check: 520, end: 300 }
  oscillator.type = kind === 'capture' ? 'triangle' : 'sine'
  oscillator.frequency.setValueAtTime(frequencies[kind], now)
  if (kind === 'end') oscillator.frequency.exponentialRampToValueAtTime(620, now + 0.28)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.13, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'end' ? 0.36 : 0.12))
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + (kind === 'end' ? 0.38 : 0.14))
}
