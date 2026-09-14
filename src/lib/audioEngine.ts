import type { MoodId, SongResult } from '../types'

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

const TARGET_PREVIEW_SECONDS = 18

interface MusicHandle {
  stop: () => void
  duration: number
}

interface AudioBuses {
  dry: AudioNode
  reverb: AudioNode
}

interface Arrangement {
  lead: 'piano' | 'pluck' | 'bell'
  pad: 'warm' | 'bowed'
  percussion: 'none' | 'soft' | 'full'
  ambience: 'air' | 'rain' | 'tape'
}

const ARRANGEMENTS: Record<MoodId, Arrangement> = {
  nostalgic: { lead: 'pluck', pad: 'bowed', percussion: 'soft', ambience: 'tape' },
  joyful: { lead: 'pluck', pad: 'warm', percussion: 'full', ambience: 'air' },
  melancholy: { lead: 'piano', pad: 'bowed', percussion: 'none', ambience: 'rain' },
  hopeful: { lead: 'piano', pad: 'warm', percussion: 'soft', ambience: 'air' },
  tense: { lead: 'pluck', pad: 'bowed', percussion: 'full', ambience: 'air' },
  tender: { lead: 'piano', pad: 'warm', percussion: 'none', ambience: 'tape' },
  calm: { lead: 'bell', pad: 'warm', percussion: 'none', ambience: 'rain' },
}

function previewBars(tempo: number) {
  const barDuration = 240 / tempo
  return Math.max(4, Math.round(TARGET_PREVIEW_SECONDS / barDuration))
}

export function getSongPreviewDuration(tempo: number) {
  return previewBars(tempo) * (240 / tempo)
}

function rootFrequency(key: string) {
  const root = key.match(/[A-G]/)?.[0] ?? 'C'
  return NOTE_FREQUENCIES[root]
}

function noteFrequency(root: number, semitone: number, octaveShift = 0) {
  return root * 2 ** ((semitone + octaveShift * 12) / 12)
}

function connectToBuses(
  context: AudioContext,
  source: AudioNode,
  buses: AudioBuses,
  dryLevel: number,
  wetLevel: number,
  pan = 0,
) {
  const panner = context.createStereoPanner()
  const dryGain = context.createGain()
  const wetGain = context.createGain()
  panner.pan.value = pan
  dryGain.gain.value = dryLevel
  wetGain.gain.value = wetLevel
  source.connect(panner)
  panner.connect(dryGain)
  panner.connect(wetGain)
  dryGain.connect(buses.dry)
  wetGain.connect(buses.reverb)
}

function createNoiseBuffer(context: AudioContext, duration: number) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
  const data = buffer.getChannelData(0)
  let previous = 0
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1
    previous = previous * 0.82 + white * 0.18
    data[index] = previous
  }
  return buffer
}

function createReverb(context: AudioContext, destination: AudioNode) {
  const convolver = context.createConvolver()
  const duration = 2.4
  const impulse = context.createBuffer(2, context.sampleRate * duration, context.sampleRate)
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel)
    for (let index = 0; index < data.length; index += 1) {
      const decay = (1 - index / data.length) ** 2.8
      data[index] = (Math.random() * 2 - 1) * decay
    }
  }
  convolver.buffer = impulse
  const returnGain = context.createGain()
  const returnFilter = context.createBiquadFilter()
  returnFilter.type = 'lowpass'
  returnFilter.frequency.value = 5200
  returnGain.gain.value = 0.24
  convolver.connect(returnFilter)
  returnFilter.connect(returnGain)
  returnGain.connect(destination)
  return convolver
}

function schedulePiano(
  context: AudioContext,
  buses: AudioBuses,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  pan = 0,
) {
  const voice = context.createGain()
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(3200, start)
  filter.frequency.exponentialRampToValueAtTime(900, start + Math.min(duration, 1.4))
  voice.gain.setValueAtTime(0.0001, start)
  voice.gain.exponentialRampToValueAtTime(volume, start + 0.012)
  voice.gain.exponentialRampToValueAtTime(volume * 0.28, start + Math.min(0.38, duration * 0.35))
  voice.gain.exponentialRampToValueAtTime(0.0001, start + duration + 0.5)
  voice.connect(filter)
  connectToBuses(context, filter, buses, 1, 0.34, pan)

  const partials = [
    { ratio: 1, level: 1, type: 'sine' as OscillatorType },
    { ratio: 2, level: 0.22, type: 'sine' as OscillatorType },
    { ratio: 3.01, level: 0.07, type: 'triangle' as OscillatorType },
  ]
  partials.forEach(({ ratio, level, type }) => {
    const oscillator = context.createOscillator()
    const partialGain = context.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency * ratio
    oscillator.detune.value = ratio === 1 ? -2 : 2
    partialGain.gain.value = level
    oscillator.connect(partialGain)
    partialGain.connect(voice)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.55)
  })
}

function schedulePluck(
  context: AudioContext,
  buses: AudioBuses,
  noiseBuffer: AudioBuffer,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  pan = 0,
) {
  const voice = context.createGain()
  const body = context.createBiquadFilter()
  body.type = 'lowpass'
  body.Q.value = 1.1
  body.frequency.setValueAtTime(Math.min(5200, frequency * 9), start)
  body.frequency.exponentialRampToValueAtTime(Math.max(700, frequency * 2.3), start + duration)
  voice.gain.setValueAtTime(0.0001, start)
  voice.gain.exponentialRampToValueAtTime(volume, start + 0.006)
  voice.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  voice.connect(body)
  connectToBuses(context, body, buses, 1, 0.2, pan)

  const fundamental = context.createOscillator()
  const shimmer = context.createOscillator()
  const shimmerGain = context.createGain()
  fundamental.type = 'triangle'
  shimmer.type = 'sine'
  fundamental.frequency.value = frequency
  shimmer.frequency.value = frequency * 2.01
  shimmerGain.gain.value = 0.16
  fundamental.connect(voice)
  shimmer.connect(shimmerGain)
  shimmerGain.connect(voice)
  fundamental.start(start)
  shimmer.start(start)
  fundamental.stop(start + duration + 0.04)
  shimmer.stop(start + duration + 0.04)

  const attack = context.createBufferSource()
  const attackFilter = context.createBiquadFilter()
  const attackGain = context.createGain()
  attack.buffer = noiseBuffer
  attackFilter.type = 'bandpass'
  attackFilter.frequency.value = Math.min(6000, frequency * 5)
  attackFilter.Q.value = 2
  attackGain.gain.setValueAtTime(volume * 0.22, start)
  attackGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.035)
  attack.connect(attackFilter)
  attackFilter.connect(attackGain)
  attackGain.connect(body)
  attack.start(start)
  attack.stop(start + 0.04)
}

function scheduleBell(
  context: AudioContext,
  buses: AudioBuses,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  pan = 0,
) {
  const voice = context.createGain()
  voice.gain.setValueAtTime(0.0001, start)
  voice.gain.exponentialRampToValueAtTime(volume, start + 0.01)
  voice.gain.exponentialRampToValueAtTime(0.0001, start + duration + 1.2)
  connectToBuses(context, voice, buses, 0.72, 0.65, pan)
  ;[1, 2.01, 3.93].forEach((ratio, index) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency * ratio
    gain.gain.value = [1, 0.2, 0.055][index]
    oscillator.connect(gain)
    gain.connect(voice)
    oscillator.start(start)
    oscillator.stop(start + duration + 1.25)
  })
}

function schedulePad(
  context: AudioContext,
  buses: AudioBuses,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  bowed: boolean,
  pan = 0,
) {
  const voice = context.createGain()
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = 0.7
  filter.frequency.value = bowed ? 1150 : 1450
  voice.gain.setValueAtTime(0.0001, start)
  voice.gain.linearRampToValueAtTime(volume, start + 0.48)
  voice.gain.setValueAtTime(volume, start + Math.max(0.5, duration - 0.8))
  voice.gain.exponentialRampToValueAtTime(0.0001, start + duration + 0.7)
  voice.connect(filter)
  connectToBuses(context, filter, buses, 0.75, 0.52, pan)

  ;[-8, 0, 8].forEach((detune, index) => {
    const oscillator = context.createOscillator()
    const oscillatorGain = context.createGain()
    oscillator.type = bowed && index === 1 ? 'sawtooth' : 'triangle'
    oscillator.frequency.value = frequency
    oscillator.detune.value = detune
    oscillatorGain.gain.value = bowed && index === 1 ? 0.16 : 0.28
    oscillator.connect(oscillatorGain)
    oscillatorGain.connect(voice)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.75)
  })
}

function scheduleBass(
  context: AudioContext,
  buses: AudioBuses,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
) {
  const voice = context.createGain()
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 340
  voice.gain.setValueAtTime(0.0001, start)
  voice.gain.exponentialRampToValueAtTime(volume, start + 0.025)
  voice.gain.exponentialRampToValueAtTime(volume * 0.42, start + duration * 0.45)
  voice.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  voice.connect(filter)
  connectToBuses(context, filter, buses, 1, 0.05)

  const sine = context.createOscillator()
  const triangle = context.createOscillator()
  const triangleGain = context.createGain()
  sine.type = 'sine'
  triangle.type = 'triangle'
  sine.frequency.value = frequency
  triangle.frequency.value = frequency * 2
  triangleGain.gain.value = 0.12
  sine.connect(voice)
  triangle.connect(triangleGain)
  triangleGain.connect(voice)
  sine.start(start)
  triangle.start(start)
  sine.stop(start + duration + 0.03)
  triangle.stop(start + duration + 0.03)
}

function scheduleKick(context: AudioContext, destination: AudioNode, start: number, volume: number) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(135, start)
  oscillator.frequency.exponentialRampToValueAtTime(46, start + 0.2)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28)
  oscillator.connect(gain)
  gain.connect(destination)
  oscillator.start(start)
  oscillator.stop(start + 0.3)
}

function scheduleSnare(
  context: AudioContext,
  destination: AudioNode,
  noiseBuffer: AudioBuffer,
  start: number,
  volume: number,
) {
  const noise = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  noise.buffer = noiseBuffer
  filter.type = 'highpass'
  filter.frequency.value = 1300
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
  noise.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  noise.start(start)
  noise.stop(start + 0.18)
}

function scheduleShaker(
  context: AudioContext,
  destination: AudioNode,
  noiseBuffer: AudioBuffer,
  start: number,
  volume: number,
) {
  const noise = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  noise.buffer = noiseBuffer
  filter.type = 'highpass'
  filter.frequency.value = 5800
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.055)
  noise.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  noise.start(start)
  noise.stop(start + 0.06)
}

function scheduleAmbience(
  context: AudioContext,
  buses: AudioBuses,
  noiseBuffer: AudioBuffer,
  start: number,
  duration: number,
  kind: Arrangement['ambience'],
) {
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  source.buffer = noiseBuffer
  source.loop = true
  filter.type = kind === 'rain' ? 'highpass' : 'lowpass'
  filter.frequency.value = kind === 'rain' ? 3600 : kind === 'tape' ? 1200 : 2200
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.linearRampToValueAtTime(kind === 'rain' ? 0.008 : 0.005, start + 1.2)
  gain.gain.setValueAtTime(kind === 'rain' ? 0.008 : 0.005, start + duration - 1)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(filter)
  filter.connect(gain)
  connectToBuses(context, gain, buses, 0.7, 0.5)
  source.start(start)
  source.stop(start + duration)
}

function storySeed(story: string) {
  let seed = 0
  for (let index = 0; index < story.length; index += 1) {
    seed = (seed * 31 + story.charCodeAt(index)) >>> 0
  }
  return seed
}

export function playSongPreview(result: SongResult, onEnded: () => void): MusicHandle {
  const context = new AudioContext()
  void context.resume()

  const master = context.createGain()
  const saturation = context.createWaveShaper()
  const compressor = context.createDynamicsCompressor()
  const curve = new Float32Array(256)
  for (let index = 0; index < curve.length; index += 1) {
    const value = index * 2 / (curve.length - 1) - 1
    curve[index] = Math.tanh(value * 1.45)
  }
  saturation.curve = curve
  saturation.oversample = '2x'
  compressor.threshold.value = -18
  compressor.knee.value = 16
  compressor.ratio.value = 3
  compressor.attack.value = 0.012
  compressor.release.value = 0.25
  master.connect(saturation)
  saturation.connect(compressor)
  compressor.connect(context.destination)

  const reverb = createReverb(context, master)
  const buses: AudioBuses = { dry: master, reverb }
  const noiseBuffer = createNoiseBuffer(context, 2)
  const arrangement = ARRANGEMENTS[result.mood.id]
  const beat = 60 / result.mood.tempo
  const bar = beat * 4
  const bars = previewBars(result.mood.tempo)
  const duration = bars * bar
  const startAt = context.currentTime + 0.08
  const root = rootFrequency(result.mood.key)
  const scale = SCALE_STEPS[result.mood.scale]
  const progression = result.mood.scale === 'minor' ? [0, 5, 3, 6] : [0, 4, 5, 3]
  const motifs = [[0, 2, 4, 2], [1, 2, 5, 4], [4, 3, 2, 1], [2, 4, 6, 4]]
  const seed = storySeed(result.story)

  master.gain.setValueAtTime(0.0001, startAt)
  master.gain.linearRampToValueAtTime(0.72, startAt + 0.35)
  master.gain.setValueAtTime(0.72, startAt + duration - 1)
  master.gain.exponentialRampToValueAtTime(0.0001, startAt + duration + 0.1)
  scheduleAmbience(context, buses, noiseBuffer, startAt, duration, arrangement.ambience)

  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const barStart = startAt + barIndex * bar
    const chordRoot = progression[barIndex % progression.length]
    const chordDegrees = [chordRoot, chordRoot + 2, chordRoot + 4]
    const dynamics = 0.78 + (barIndex / Math.max(1, bars - 1)) * 0.22
    const isLastBar = barIndex === bars - 1

    chordDegrees.forEach((degree, noteIndex) => {
      const semitone = scale[degree % scale.length] + (degree >= scale.length ? 12 : 0)
      schedulePad(
        context,
        buses,
        noteFrequency(root, semitone, -1),
        barStart,
        bar * (isLastBar ? 1.15 : 0.92),
        0.026 * dynamics,
        arrangement.pad === 'bowed',
        (noteIndex - 1) * 0.2,
      )
    })

    const rootSemitone = scale[chordRoot % scale.length]
    scheduleBass(context, buses, noteFrequency(root, rootSemitone, -2), barStart, beat * 1.55, 0.105 * dynamics)
    if (!isLastBar) {
      scheduleBass(context, buses, noteFrequency(root, rootSemitone, -2), barStart + beat * 2, beat * 1.45, 0.082 * dynamics)
    }

    const arpeggioPattern = [0, 1, 2, 1, 0, 1, 2, 1]
    const arpeggioSteps = arrangement.percussion === 'none' ? 4 : 8
    for (let step = 0; step < arpeggioSteps; step += 1) {
      const chordDegree = chordDegrees[arpeggioPattern[step]]
      const semitone = scale[chordDegree % scale.length] + (chordDegree >= scale.length ? 12 : 0)
      const noteStart = barStart + step * (bar / arpeggioSteps)
      if (arrangement.lead === 'piano') {
        schedulePiano(context, buses, noteFrequency(root, semitone, -1), noteStart, beat * 0.8, 0.022 * dynamics, step % 2 ? 0.22 : -0.22)
      } else {
        schedulePluck(context, buses, noiseBuffer, noteFrequency(root, semitone, -1), noteStart, beat * 0.72, 0.034 * dynamics, step % 2 ? 0.25 : -0.25)
      }
    }

    const motif = motifs[(barIndex + seed) % motifs.length]
    motif.forEach((degree, beatIndex) => {
      if (barIndex === 0 && beatIndex < 2) return
      const melodyStart = barStart + beatIndex * beat
      const melodyDuration = isLastBar && beatIndex === 0 ? beat * 3.3 : beat * (beatIndex === 3 ? 0.85 : 0.62)
      const melodyDegree = isLastBar ? 0 : degree
      const frequency = noteFrequency(root, scale[melodyDegree % scale.length], beatIndex % 3 === 1 ? 1 : 0)
      const pan = beatIndex % 2 ? 0.09 : -0.09
      if (arrangement.lead === 'bell') {
        scheduleBell(context, buses, frequency, melodyStart, melodyDuration, 0.032 * dynamics, pan)
      } else if (arrangement.lead === 'pluck') {
        schedulePluck(context, buses, noiseBuffer, frequency, melodyStart, melodyDuration, 0.045 * dynamics, pan)
      } else {
        schedulePiano(context, buses, frequency, melodyStart, melodyDuration, 0.052 * dynamics, pan)
        if ((barIndex + beatIndex) % 5 === 0) {
          scheduleBell(context, buses, frequency * 2, melodyStart, melodyDuration, 0.009, pan * -1)
        }
      }
    })

    if (arrangement.percussion !== 'none' && barIndex > 0 && !isLastBar) {
      scheduleKick(context, master, barStart, arrangement.percussion === 'full' ? 0.13 : 0.085)
      scheduleKick(context, master, barStart + beat * 2, arrangement.percussion === 'full' ? 0.105 : 0.065)
      scheduleSnare(context, master, noiseBuffer, barStart + beat, arrangement.percussion === 'full' ? 0.055 : 0.032)
      scheduleSnare(context, master, noiseBuffer, barStart + beat * 3, arrangement.percussion === 'full' ? 0.05 : 0.03)
      if (arrangement.percussion === 'full') {
        for (let step = 0; step < 8; step += 1) {
          scheduleShaker(context, master, noiseBuffer, barStart + step * beat / 2, step % 2 ? 0.015 : 0.01)
        }
      }
    }
  }

  const timeout = window.setTimeout(() => {
    void context.close()
    onEnded()
  }, (duration + 0.25) * 1000)

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
