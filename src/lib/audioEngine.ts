import type { SongResult } from '../types'

const NOTE_FREQUENCIES: Record<string, number> = {
  C: 261.63,
  D: 293.66,
  E: 329.63,
  F: 349.23,
  G: 392,
  A: 440,
  B: 493.88,
}

const SCALE_STEPS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
}

interface MusicHandle {
  stop: () => void
  duration: number
}

function rootFrequency(key: string) {
  const root = key.match(/[A-G]/)?.[0] ?? 'C'
  return NOTE_FREQUENCIES[root]
}

function noteFrequency(root: number, semitone: number, octaveShift = 0) {
  return root * 2 ** ((semitone + octaveShift * 12) / 12)
}

function connectWithGain(
  context: AudioContext,
  source: AudioNode,
  destination: AudioNode,
  volume: number,
  start: number,
  end: number,
) {
  const gain = context.createGain()
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  source.connect(gain)
  gain.connect(destination)
}

function scheduleTone(
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  wave: OscillatorType,
) {
  const oscillator = context.createOscillator()
  oscillator.type = wave
  oscillator.frequency.value = frequency
  oscillator.detune.setValueAtTime(-3, start)
  oscillator.detune.linearRampToValueAtTime(3, start + duration)
  connectWithGain(context, oscillator, destination, volume, start, start + duration)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.05)
}

function scheduleNoise(
  context: AudioContext,
  destination: AudioNode,
  start: number,
  duration: number,
  volume: number,
) {
  const frameCount = Math.floor(context.sampleRate * duration)
  const buffer = context.createBuffer(1, frameCount, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frameCount; i += 1) data[i] = Math.random() * 2 - 1
  const source = context.createBufferSource()
  source.buffer = buffer
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 480
  source.connect(filter)
  connectWithGain(context, filter, destination, volume, start, start + duration)
  source.start(start)
  source.stop(start + duration)
}

export function playSongPreview(result: SongResult, onEnded: () => void): MusicHandle {
  const context = new AudioContext()
  const master = context.createGain()
  const compressor = context.createDynamicsCompressor()
  master.gain.value = 0.74
  master.connect(compressor)
  compressor.connect(context.destination)

  const delay = context.createDelay(1)
  const feedback = context.createGain()
  delay.delayTime.value = 0.28
  feedback.gain.value = 0.18
  delay.connect(feedback)
  feedback.connect(delay)
  delay.connect(master)

  const beat = 60 / result.mood.tempo
  const bar = beat * 4
  const bars = 8
  const duration = bars * bar
  const startAt = context.currentTime + 0.08
  const root = rootFrequency(result.mood.key)
  const scale = SCALE_STEPS[result.mood.scale]
  const progression = result.mood.scale === 'minor' ? [0, 5, 3, 6] : [0, 4, 5, 3]

  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const barStart = startAt + barIndex * bar
    const chordRoot = progression[barIndex % progression.length]
    const chordNotes = [chordRoot, chordRoot + 2, chordRoot + 4]

    chordNotes.forEach((degree, noteIndex) => {
      const semitone = scale[degree % scale.length] + (degree >= scale.length ? 12 : 0)
      scheduleTone(context, master, noteFrequency(root, semitone, -1), barStart, bar * 0.96, 0.035, 'sine')
      scheduleTone(context, delay, noteFrequency(root, semitone), barStart, bar * 0.82, 0.012, 'triangle')
      if (noteIndex === 0) {
        scheduleTone(context, master, noteFrequency(root, semitone, -2), barStart, beat * 1.4, 0.055, 'sine')
        scheduleTone(context, master, noteFrequency(root, semitone, -2), barStart + beat * 2, beat * 1.4, 0.045, 'sine')
      }
    })

    for (let beatIndex = 0; beatIndex < 4; beatIndex += 1) {
      const melodyDegree = (barIndex * 2 + beatIndex + (barIndex % 3)) % scale.length
      const melodyStart = barStart + beatIndex * beat
      const melodyDuration = beat * (beatIndex === 3 ? 0.85 : 0.58)
      scheduleTone(
        context,
        delay,
        noteFrequency(root, scale[melodyDegree], beatIndex % 2 === 0 ? 0 : 1),
        melodyStart,
        melodyDuration,
        0.028 + result.mood.energy / 6000,
        result.mood.energy > 70 ? 'sawtooth' : 'triangle',
      )
      if (result.mood.energy > 45 && beatIndex % 2 === 0) {
        scheduleNoise(context, master, melodyStart, 0.08, 0.018)
      }
    }
  }

  const timeout = window.setTimeout(() => {
    void context.close()
    onEnded()
  }, (duration + 0.2) * 1000)

  return {
    duration,
    stop: () => {
      window.clearTimeout(timeout)
      master.gain.cancelScheduledValues(context.currentTime)
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.001), context.currentTime)
      master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18)
      window.setTimeout(() => void context.close(), 220)
    },
  }
}
