import type { MoodId, SongResult } from '../types'
import { hasAffirmedStoryTerm } from './storyEngine'

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

const TARGET_PREVIEW_SECONDS = 26
const RELEASE_TAIL_SECONDS = 0.65
const SAMPLE_FETCH_TIMEOUT_MS = 10_000

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

interface MusicHandle {
  stop: () => void
  duration: number
}

type SampleInstrument = 'piano' | 'guitar' | 'cello' | 'xylophone' | 'kick' | 'shakerUp' | 'shakerDown' | 'woodblock'

interface SampleDefinition {
  instrument: SampleInstrument
  path: string
  rootMidi: number
  level: number
}

interface DecodedSample extends SampleDefinition {
  buffer: AudioBuffer
}

type SampleBank = Record<SampleInstrument, DecodedSample[]>

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

interface StoryScene {
  label: string
  ambience: Arrangement['ambience']
  home: boolean
  rain: boolean
  transit: boolean
  celestial: boolean
  water: boolean
}

export interface ArrangementTrack {
  id: string
  label: string
  role: string
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

function getArrangement(result: SongResult): Arrangement {
  const base = ARRANGEMENTS[result.mood.id]
  const { valence, direction, dimensions } = result.analysis
  if (result.mood.id === 'joyful' && valence > 0.28 && dimensions.grief + dimensions.tension < 0.72) {
    return { ...base, lead: 'pluck', pad: 'warm', percussion: 'full', ambience: 'air' }
  }
  if (dimensions.tension > 0.54) {
    return { ...base, lead: 'pluck', pad: 'bowed', percussion: 'full', ambience: dimensions.openness > 0.38 ? 'air' : base.ambience }
  }
  if (dimensions.grief > 0.38 || dimensions.isolation > 0.52) {
    return { ...base, lead: dimensions.nostalgia > dimensions.grief * 0.8 ? 'pluck' : 'piano', pad: 'bowed', percussion: 'none' }
  }
  if (direction === 'rising' || dimensions.hope + dimensions.agency > 0.9) {
    return { ...base, lead: 'piano', pad: dimensions.tension > 0.24 ? 'bowed' : 'warm', percussion: 'soft', ambience: 'air' }
  }
  if (dimensions.nostalgia > 0.46) return { ...base, lead: 'pluck', pad: 'bowed', percussion: 'soft', ambience: 'tape' }
  if (dimensions.calm > 0.48 && valence >= -0.18) return { ...base, lead: 'bell', pad: 'warm', percussion: 'none' }
  return base
}

const SAMPLE_DEFINITIONS: SampleDefinition[] = [
  { instrument: 'piano', path: 'piano/C3.mp3', rootMidi: 48, level: 0.82 },
  { instrument: 'piano', path: 'piano/A3.mp3', rootMidi: 57, level: 0.9 },
  { instrument: 'piano', path: 'piano/C4.mp3', rootMidi: 60, level: 0.86 },
  { instrument: 'piano', path: 'piano/E4.mp3', rootMidi: 64, level: 0.95 },
  { instrument: 'piano', path: 'piano/A4.mp3', rootMidi: 69, level: 0.92 },
  { instrument: 'piano', path: 'piano/C5.mp3', rootMidi: 72, level: 0.9 },
  { instrument: 'piano', path: 'piano/A5.mp3', rootMidi: 81, level: 0.86 },
  { instrument: 'guitar', path: 'guitar-acoustic/C3.mp3', rootMidi: 48, level: 0.76 },
  { instrument: 'guitar', path: 'guitar-acoustic/E3.mp3', rootMidi: 52, level: 0.82 },
  { instrument: 'guitar', path: 'guitar-acoustic/G3.mp3', rootMidi: 55, level: 0.88 },
  { instrument: 'guitar', path: 'guitar-acoustic/C4.mp3', rootMidi: 60, level: 0.9 },
  { instrument: 'guitar', path: 'guitar-acoustic/E4.mp3', rootMidi: 64, level: 0.86 },
  { instrument: 'guitar', path: 'guitar-acoustic/A4.mp3', rootMidi: 69, level: 0.82 },
  { instrument: 'guitar', path: 'guitar-acoustic/C5.mp3', rootMidi: 72, level: 0.78 },
  { instrument: 'guitar', path: 'guitar-acoustic/D5.mp3', rootMidi: 74, level: 0.76 },
  { instrument: 'cello', path: 'cello/C2.mp3', rootMidi: 36, level: 0.9 },
  { instrument: 'cello', path: 'cello/G2.mp3', rootMidi: 43, level: 0.92 },
  { instrument: 'cello', path: 'cello/C3.mp3', rootMidi: 48, level: 0.88 },
  { instrument: 'cello', path: 'cello/G3.mp3', rootMidi: 55, level: 0.86 },
  { instrument: 'cello', path: 'cello/C4.mp3', rootMidi: 60, level: 0.82 },
  { instrument: 'xylophone', path: 'xylophone/G4.mp3', rootMidi: 67, level: 0.72 },
  { instrument: 'xylophone', path: 'xylophone/C5.mp3', rootMidi: 72, level: 0.76 },
  { instrument: 'xylophone', path: 'xylophone/G5.mp3', rootMidi: 79, level: 0.7 },
  { instrument: 'xylophone', path: 'xylophone/C6.mp3', rootMidi: 84, level: 0.66 },
  { instrument: 'kick', path: '../percussion/kick.wav', rootMidi: 69, level: 0.72 },
  { instrument: 'shakerUp', path: '../percussion/shaker-up.wav', rootMidi: 69, level: 0.7 },
  { instrument: 'shakerDown', path: '../percussion/shaker-down.wav', rootMidi: 69, level: 0.7 },
  { instrument: 'woodblock', path: '../percussion/woodblock.wav', rootMidi: 69, level: 0.72 },
]

const rawSampleCache = new Map<string, Promise<ArrayBuffer>>()
let decodedSampleBank: Promise<SampleBank> | null = null

function sampleAssetUrl(path: string) {
  return new URL(`${import.meta.env.BASE_URL}audio/instruments/${path}`, document.baseURI).href
}

function fetchSample(path: string) {
  const cached = rawSampleCache.get(path)
  if (cached) return cached
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), SAMPLE_FETCH_TIMEOUT_MS)
  const request = fetch(sampleAssetUrl(path), { signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Unable to load audio sample: ${path}`)
      return response.arrayBuffer()
    })
    .catch((error) => {
      rawSampleCache.delete(path)
      throw error
    })
    .finally(() => window.clearTimeout(timeout))
  rawSampleCache.set(path, request)
  return request
}

function decodeSample(context: BaseAudioContext, data: ArrayBuffer) {
  return context.decodeAudioData(data.slice(0))
}

async function loadSampleBank() {
  if (decodedSampleBank) return decodedSampleBank
  const decoder = new OfflineAudioContext(1, 1, 44_100)
  const preparation = Promise.all(SAMPLE_DEFINITIONS.map(async (definition) => {
    try {
      const data = await fetchSample(definition.path)
      const buffer = await decodeSample(decoder, data)
      return { ...definition, buffer }
    } catch {
      return null
    }
  })).then((samples) => {
    const bank: SampleBank = {
      piano: [],
      guitar: [],
      cello: [],
      xylophone: [],
      kick: [],
      shakerUp: [],
      shakerDown: [],
      woodblock: [],
    }
    samples.forEach((sample) => {
      if (sample) bank[sample.instrument].push(sample)
    })
    if (samples.some((sample) => !sample)) decodedSampleBank = null
    return bank
  })
  decodedSampleBank = preparation
  return preparation
}

export function preloadAudioSamples() {
  return Promise.allSettled(SAMPLE_DEFINITIONS.map(({ path }) => fetchSample(path))).then(() => undefined)
}

function getStoryScene(story: string, fallback: Arrangement['ambience']): StoryScene {
  const includes = (...terms: string[]) => hasAffirmedStoryTerm(story, terms)
  const home = includes('外婆', '爷爷', '奶奶', '妈妈', '爸爸', '家人', '回家', '院子', '故乡')
  const rain = includes('下雨', '雨里', '雨夜', '雨声', '雨滴', '暴雨')
  const transit = includes('火车', '地铁', '车站', '站台', '公路', '开车', '城市', '出发')
  const celestial = includes('夜晚', '夏夜', '凌晨', '星星', '星空', '月亮', '月光')
  const water = includes('大海', '海面', '海边', '湖边', '河边', '浪花', '海风')
  const label = rain
    ? '雨夜空间'
    : transit
      ? '移动旅途'
      : home
        ? '旧家记忆'
        : water
          ? '海风远景'
          : celestial
            ? '夜空微光'
            : '留白空间'

  return {
    label,
    ambience: rain ? 'rain' : home ? 'tape' : water || celestial ? 'air' : fallback,
    home,
    rain,
    transit,
    celestial,
    water,
  }
}

function shouldUseCelestialAccents(result: SongResult, scene: StoryScene) {
  return scene.celestial && result.analysis.dimensions.hope + result.analysis.dimensions.joy > 0.42
}

function shouldUseRestrainedShaker(result: SongResult, arrangement: Arrangement) {
  const { grief, isolation, hope, agency } = result.analysis.dimensions
  return arrangement.percussion === 'none'
    && hope + agency > 0.72
    && grief + isolation < 0.58
}

export function getArrangementTracks(result: SongResult): ArrangementTrack[] {
  const arrangement = getArrangement(result)
  const scene = getStoryScene(result.story, arrangement.ambience)
  const leadNames = { piano: '实录柔音钢琴', pluck: '实录原声吉他', bell: '实录木琴泛音' }
  const padNames = { warm: '大提琴室内和声', bowed: '大提琴弓弦层' }
  const tracks: ArrangementTrack[] = [
    { id: 'lead', label: leadNames[arrangement.lead], role: '主题旋律' },
    { id: 'pad', label: padNames[arrangement.pad], role: '情绪和声' },
    { id: 'bass', label: '大提琴低音', role: '低频叙事线' },
  ]

  if (result.analysis.dimensions.isolation < 0.62) {
    tracks.push({ id: 'counterline', label: '钢琴与吉他回应', role: '后半段变奏' })
  }

  if (arrangement.percussion !== 'none') {
    tracks.push({
      id: 'rhythm',
      label: arrangement.percussion === 'full' ? '实录低鼓、木块与沙锤' : '实录轻打击乐',
      role: '节奏脉冲',
    })
  }
  if (scene.home) tracks.push({ id: 'memory', label: '原声吉他泛音', role: '家的记忆' })
  if (scene.transit) tracks.push({ id: 'transit', label: '木质移动节拍', role: '旅途推进' })
  if (shouldUseCelestialAccents(result, scene)) tracks.push({ id: 'stars', label: '木琴星点', role: '夜空高光' })
  if (result.analysis.dimensions.openness > 0.34) tracks.push({ id: 'openness', label: '开阔吉他泛音', role: '自由与远方' })
  if (result.analysis.dimensions.isolation > 0.46) tracks.push({ id: 'silence', label: '低音留白', role: '孤独与停顿' })
  if (shouldUseRestrainedShaker(result, arrangement)) tracks.push({ id: 'brush', label: '实录细沙锤', role: '克制律动' })
  tracks.push({
    id: 'ambience',
    label: scene.rain ? '雨幕空气感' : scene.water ? '海风空气层' : scene.home ? '磁带空气感' : '空间空气层',
    role: scene.label,
  })
  return tracks
}

function previewBars(tempo: number) {
  const barDuration = 240 / tempo
  return Math.max(6, Math.round(TARGET_PREVIEW_SECONDS / barDuration))
}

export function getSongPreviewDuration(tempo: number) {
  return previewBars(tempo) * (240 / tempo) + RELEASE_TAIL_SECONDS
}

function rootFrequency(key: string) {
  const root = key.match(/[A-G]/)?.[0] ?? 'C'
  return NOTE_FREQUENCIES[root]
}

function noteFrequency(root: number, semitone: number, octaveShift = 0) {
  return root * 2 ** ((semitone + octaveShift * 12) / 12)
}

function degreeSemitone(scale: number[], degree: number) {
  const octave = Math.floor(degree / scale.length)
  const index = ((degree % scale.length) + scale.length) % scale.length
  return scale[index] + octave * 12
}

function seededUnit(seed: number, index: number) {
  let value = (seed + index * 0x9e3779b9) >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  return (value >>> 0) / 0xffffffff
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

function frequencyToMidi(frequency: number) {
  return 69 + 12 * Math.log2(frequency / 440)
}

function foldMidiIntoSampleRange(samples: DecodedSample[], targetMidi: number) {
  const roots = samples.map(({ rootMidi }) => rootMidi)
  const lowest = Math.min(...roots)
  const highest = Math.max(...roots)
  let foldedMidi = targetMidi
  while (foldedMidi < lowest - 5) foldedMidi += 12
  while (foldedMidi > highest + 5) foldedMidi -= 12
  return foldedMidi
}

function nearestSample(samples: DecodedSample[], targetMidi: number) {
  return samples.reduce<DecodedSample | null>((closest, sample) => {
    if (!closest) return sample
    return Math.abs(sample.rootMidi - targetMidi) < Math.abs(closest.rootMidi - targetMidi) ? sample : closest
  }, null)
}

function scheduleSampledVoice(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank,
  instrument: SampleInstrument,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  pan: number,
  options: { attack: number; release: number; dry: number; wet: number; lowpass?: number },
) {
  const samples = sampleBank[instrument]
  if (!samples.length) return false
  const targetMidi = foldMidiIntoSampleRange(samples, frequencyToMidi(frequency))
  const sample = nearestSample(samples, targetMidi)
  if (!sample) return false

  const source = context.createBufferSource()
  const voice = context.createGain()
  const filter = context.createBiquadFilter()
  const playbackRate = 2 ** ((targetMidi - sample.rootMidi) / 12)
  const availableDuration = sample.buffer.duration / playbackRate
  const naturalTail = instrument === 'cello' ? 0.55 : instrument === 'piano' ? 0.72 : 0.42
  const stopAfter = Math.max(0.08, Math.min(duration + options.release + naturalTail, availableDuration - 0.015))
  const releaseStart = Math.max(options.attack + 0.03, Math.min(duration, stopAfter - options.release))

  source.buffer = sample.buffer
  source.playbackRate.setValueAtTime(playbackRate, start)
  voice.gain.setValueAtTime(0.0001, start)
  voice.gain.linearRampToValueAtTime(volume * sample.level, start + options.attack)
  voice.gain.setValueAtTime(volume * sample.level, start + releaseStart)
  voice.gain.exponentialRampToValueAtTime(0.0001, start + stopAfter)
  filter.type = 'lowpass'
  filter.frequency.value = options.lowpass ?? 7600
  source.connect(filter)
  filter.connect(voice)
  connectToBuses(context, voice, buses, options.dry, options.wet, pan)
  source.start(start)
  source.stop(start + stopAfter + 0.02)
  return true
}

function scheduleSampledOneShot(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  instrument: 'kick' | 'shakerUp' | 'shakerDown' | 'woodblock',
  start: number,
  volume: number,
  pan: number,
  options: { dry: number; wet: number; maxDuration: number; playbackRate?: number; lowpass?: number },
) {
  const sample = sampleBank?.[instrument][0]
  if (!sample) return false
  const source = context.createBufferSource()
  const voice = context.createGain()
  const filter = context.createBiquadFilter()
  const playbackRate = options.playbackRate ?? 1
  const duration = Math.min(options.maxDuration, sample.buffer.duration / playbackRate)
  source.buffer = sample.buffer
  source.playbackRate.setValueAtTime(playbackRate, start)
  voice.gain.setValueAtTime(0.0001, start)
  voice.gain.linearRampToValueAtTime(volume * sample.level, start + 0.004)
  voice.gain.setValueAtTime(volume * sample.level, start + Math.max(0.008, duration - 0.09))
  voice.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  filter.type = 'lowpass'
  filter.frequency.value = options.lowpass ?? 9000
  source.connect(filter)
  filter.connect(voice)
  connectToBuses(context, voice, buses, options.dry, options.wet, pan)
  source.start(start)
  source.stop(start + duration + 0.02)
  return true
}

function createNoiseBuffer(context: AudioContext, duration: number, seed: number) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
  const data = buffer.getChannelData(0)
  let previous = 0
  let state = seed || 1
  for (let index = 0; index < data.length; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0
    const white = state / 0xffffffff * 2 - 1
    previous = previous * 0.82 + white * 0.18
    data[index] = previous
  }
  return buffer
}

function createReverb(context: AudioContext, destination: AudioNode, seed: number) {
  const convolver = context.createConvolver()
  const duration = 1.45
  const impulse = context.createBuffer(2, context.sampleRate * duration, context.sampleRate)
  let state = seed || 1
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel)
    for (let index = 0; index < data.length; index += 1) {
      const decay = (1 - index / data.length) ** 2.35
      state = (state * 1664525 + 1013904223) >>> 0
      data[index] = (state / 0xffffffff * 2 - 1) * decay
    }
  }
  convolver.buffer = impulse
  const returnGain = context.createGain()
  const returnFilter = context.createBiquadFilter()
  returnFilter.type = 'lowpass'
  returnFilter.frequency.value = 4800
  returnGain.gain.value = 0.17
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

function scheduleAcousticPiano(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  pan = 0,
) {
  if (sampleBank && scheduleSampledVoice(
    context,
    buses,
    sampleBank,
    'piano',
    frequency,
    start,
    duration,
    volume * 1.18,
    pan,
    { attack: 0.012, release: 0.38, dry: 0.96, wet: 0.26, lowpass: 6800 },
  )) return
  schedulePiano(context, buses, frequency, start, duration, volume, pan)
}

function scheduleAcousticGuitar(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  noiseBuffer: AudioBuffer,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  pan = 0,
) {
  if (sampleBank && scheduleSampledVoice(
    context,
    buses,
    sampleBank,
    'guitar',
    frequency,
    start,
    duration,
    volume * 1.34,
    pan,
    { attack: 0.006, release: 0.24, dry: 1, wet: 0.2, lowpass: 7200 },
  )) return
  schedulePluck(context, buses, noiseBuffer, frequency, start, duration, volume, pan)
}

function scheduleAcousticBell(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  pan = 0,
) {
  if (sampleBank && scheduleSampledVoice(
    context,
    buses,
    sampleBank,
    'xylophone',
    frequency,
    start,
    duration,
    volume * 1.16,
    pan,
    { attack: 0.008, release: 0.42, dry: 0.78, wet: 0.48, lowpass: 6200 },
  )) return
  scheduleBell(context, buses, frequency, start, duration, volume, pan)
}

function scheduleCelloLayer(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  pan: number,
  fallbackBowed: boolean,
) {
  const sampledTone = fallbackBowed
    ? { gain: 1.42, attack: 0.28, wet: 0.42, lowpass: 3600 }
    : { gain: 1.32, attack: 0.16, wet: 0.31, lowpass: 4700 }
  if (sampleBank && scheduleSampledVoice(
    context,
    buses,
    sampleBank,
    'cello',
    frequency,
    start,
    duration,
    volume * sampledTone.gain,
    pan,
    { attack: sampledTone.attack, release: 0.46, dry: 0.78, wet: sampledTone.wet, lowpass: sampledTone.lowpass },
  )) return
  schedulePad(context, buses, frequency, start, duration, volume, fallbackBowed, pan)
}

function scheduleAcousticBass(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
) {
  if (sampleBank && scheduleSampledVoice(
    context,
    buses,
    sampleBank,
    'cello',
    frequency,
    start,
    duration,
    volume * 0.82,
    0,
    { attack: 0.035, release: 0.28, dry: 0.94, wet: 0.11, lowpass: 820 },
  )) return
  scheduleBass(context, buses, frequency, start, duration, volume)
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

function scheduleWoodblock(context: AudioContext, destination: AudioNode, start: number, volume: number) {
  const oscillator = context.createOscillator()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(760, start)
  oscillator.frequency.exponentialRampToValueAtTime(430, start + 0.07)
  filter.type = 'bandpass'
  filter.frequency.value = 680
  filter.Q.value = 3.5
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11)
  oscillator.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  oscillator.start(start)
  oscillator.stop(start + 0.12)
}

function scheduleRecordedKick(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  start: number,
  volume: number,
) {
  if (scheduleSampledOneShot(
    context,
    buses,
    sampleBank,
    'kick',
    start,
    volume * 1.22,
    0,
    { dry: 1, wet: 0.06, maxDuration: 1.15, lowpass: 3100 },
  )) return
  scheduleKick(context, buses.dry, start, volume)
}

function scheduleRecordedShaker(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  noiseBuffer: AudioBuffer,
  start: number,
  volume: number,
  upStroke: boolean,
  pan: number,
) {
  if (scheduleSampledOneShot(
    context,
    buses,
    sampleBank,
    upStroke ? 'shakerUp' : 'shakerDown',
    start,
    volume * 1.55,
    pan,
    { dry: 0.88, wet: 0.18, maxDuration: upStroke ? 0.24 : 0.42, lowpass: 8200 },
  )) return
  scheduleShaker(context, buses.dry, noiseBuffer, start, volume)
}

function scheduleRecordedWoodblock(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  start: number,
  volume: number,
  pan = 0,
) {
  if (scheduleSampledOneShot(
    context,
    buses,
    sampleBank,
    'woodblock',
    start,
    volume * 1.28,
    pan,
    { dry: 0.9, wet: 0.16, maxDuration: 0.62, playbackRate: 0.96, lowpass: 6600 },
  )) return
  scheduleWoodblock(context, buses.dry, start, volume)
}

function scheduleSwell(
  context: AudioContext,
  buses: AudioBuses,
  noiseBuffer: AudioBuffer,
  start: number,
  duration: number,
  volume: number,
) {
  const noise = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  noise.buffer = noiseBuffer
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(650, start)
  filter.frequency.exponentialRampToValueAtTime(2800, start + duration)
  filter.Q.value = 0.6
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + duration * 0.76)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  noise.connect(filter)
  filter.connect(gain)
  connectToBuses(context, gain, buses, 0.32, 0.74)
  noise.start(start)
  noise.stop(start + duration + 0.02)
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

function scheduleComposition(
  context: AudioContext,
  result: SongResult,
  destination: AudioNode,
  startAt: number,
  sampleBank?: SampleBank,
) {
  const seed = storySeed(result.story)
  const master = context.createGain()
  const saturation = context.createWaveShaper()
  const compressor = context.createDynamicsCompressor()
  const output = context.createGain()
  const curve = new Float32Array(256)
  for (let index = 0; index < curve.length; index += 1) {
    const value = index * 2 / (curve.length - 1) - 1
    curve[index] = Math.tanh(value * 1.18)
  }
  saturation.curve = curve
  saturation.oversample = '2x'
  compressor.threshold.value = -16
  compressor.knee.value = 18
  compressor.ratio.value = 2.2
  compressor.attack.value = 0.025
  compressor.release.value = 0.34
  output.gain.value = 5.6
  master.connect(saturation)
  saturation.connect(compressor)
  compressor.connect(output)
  output.connect(destination)

  const reverb = createReverb(context, master, seed ^ 0x51f15e)
  const buses: AudioBuses = { dry: master, reverb }
  const noiseBuffer = createNoiseBuffer(context, 3, seed ^ 0xa53a9d)
  const arrangement = getArrangement(result)
  const scene = getStoryScene(result.story, arrangement.ambience)
  const beat = 60 / result.mood.tempo
  const bar = beat * 4
  const bars = previewBars(result.mood.tempo)
  const musicalDuration = bars * bar
  const duration = musicalDuration + RELEASE_TAIL_SECONDS
  const root = rootFrequency(result.mood.key)
  const scale = SCALE_STEPS[result.mood.scale]
  const progressionBanks = result.mood.scale === 'minor'
    ? [[0, 5, 3, 6, 0, 5, 4, 0], [0, 3, 5, 4, 0, 6, 3, 0], [0, 6, 5, 3, 0, 4, 5, 0]]
    : [[0, 4, 5, 3, 0, 5, 3, 4], [0, 3, 4, 5, 0, 4, 3, 0], [0, 5, 3, 4, 0, 3, 5, 0]]
  const joyfulProgressions = [[0, 3, 4, 4, 0, 3, 1, 4], [0, 4, 5, 3, 0, 4, 1, 4]]
  const isJoyful = result.mood.id === 'joyful'
    && result.analysis.valence > 0.28
    && result.analysis.dimensions.grief + result.analysis.dimensions.tension < 0.72
  const progressionSource = isJoyful ? joyfulProgressions : progressionBanks
  const progression = progressionSource[seed % progressionSource.length]
  const balancedMotifs = [
    [{ at: 0, degree: 0, length: 0.68 }, { at: 0.9, degree: 2, length: 0.55 }, { at: 2.05, degree: 4, length: 0.78 }, { at: 3.2, degree: 2, length: 0.72 }],
    [{ at: 0, degree: 1, length: 0.52 }, { at: 0.72, degree: 2, length: 0.7 }, { at: 1.9, degree: 5, length: 0.62 }, { at: 2.85, degree: 4, length: 1.02 }],
    [{ at: 0, degree: 4, length: 0.72 }, { at: 1.05, degree: 3, length: 0.52 }, { at: 1.82, degree: 2, length: 0.66 }, { at: 3.05, degree: 1, length: 0.86 }],
    [{ at: 0, degree: 2, length: 0.55 }, { at: 0.8, degree: 4, length: 0.82 }, { at: 2.1, degree: 6, length: 0.55 }, { at: 2.95, degree: 4, length: 0.95 }],
  ]
  const descendingMotifs = [
    [{ at: 0, degree: 5, length: 0.82 }, { at: 1.08, degree: 4, length: 0.64 }, { at: 2.08, degree: 2, length: 0.76 }, { at: 3.22, degree: 1, length: 1.12 }],
    [{ at: 0.18, degree: 4, length: 0.72 }, { at: 1.2, degree: 3, length: 0.72 }, { at: 2.18, degree: 1, length: 0.9 }, { at: 3.42, degree: 0, length: 1.18 }],
    [{ at: 0, degree: 3, length: 0.88 }, { at: 1.34, degree: 2, length: 0.62 }, { at: 2.35, degree: 0, length: 0.8 }, { at: 3.45, degree: -1, length: 1.05 }],
  ]
  const risingMotifs = [
    [{ at: 0, degree: 0, length: 0.58 }, { at: 0.86, degree: 1, length: 0.56 }, { at: 1.78, degree: 3, length: 0.7 }, { at: 2.9, degree: 4, length: 1.1 }],
    [{ at: 0.12, degree: 1, length: 0.62 }, { at: 1.05, degree: 2, length: 0.58 }, { at: 2.02, degree: 4, length: 0.7 }, { at: 3.08, degree: 5, length: 1.02 }],
  ]
  const joyfulMotifs = [
    [{ at: 0, degree: 0, length: 0.38 }, { at: 0.55, degree: 2, length: 0.32 }, { at: 1.12, degree: 4, length: 0.42 }, { at: 1.9, degree: 5, length: 0.34 }, { at: 2.48, degree: 4, length: 0.38 }, { at: 3.08, degree: 6, length: 0.62 }],
    [{ at: 0.12, degree: 2, length: 0.34 }, { at: 0.68, degree: 4, length: 0.38 }, { at: 1.3, degree: 5, length: 0.34 }, { at: 1.92, degree: 4, length: 0.32 }, { at: 2.5, degree: 2, length: 0.36 }, { at: 3.12, degree: 4, length: 0.6 }],
  ]
  const tenseMotifs = [
    [{ at: 0, degree: 0, length: 0.42 }, { at: 0.64, degree: 4, length: 0.44 }, { at: 1.46, degree: 1, length: 0.4 }, { at: 2.24, degree: 5, length: 0.46 }, { at: 3.18, degree: 3, length: 0.68 }],
    [{ at: 0, degree: 5, length: 0.4 }, { at: 0.72, degree: 2, length: 0.48 }, { at: 1.58, degree: 6, length: 0.42 }, { at: 2.4, degree: 1, length: 0.48 }, { at: 3.28, degree: 4, length: 0.62 }],
  ]
  const motifTemplates = isJoyful
    ? joyfulMotifs
    : result.analysis.dimensions.tension > 0.5
    ? tenseMotifs
    : result.analysis.dimensions.grief > 0.42
      ? descendingMotifs
      : result.analysis.direction === 'rising' || result.analysis.dimensions.hope > 0.48
        ? risingMotifs
        : balancedMotifs
  const baseMotif = seed % motifTemplates.length
  const coreMotif = motifTemplates[baseMotif]
  const leadOctave = result.analysis.dimensions.grief + result.analysis.dimensions.isolation > 0.72 ? -1 : 0
  const spaciousness = result.analysis.dimensions.openness
  const sparseness = clamp(
    result.analysis.dimensions.grief * 0.45
      + result.analysis.dimensions.calm * 0.35
      + result.analysis.dimensions.isolation * 0.5,
    0,
    1,
  )
  const introBars = isJoyful ? 1 : bars >= 10 ? 2 : 1
  const liftStart = Math.max(introBars + 2, Math.floor(bars * 0.58))
  const outroIndex = bars - 1
  const introEnd = startAt + introBars * bar
  const liftAt = startAt + liftStart * bar
  const outroAt = startAt + outroIndex * bar

  master.gain.setValueAtTime(0.0001, startAt)
  master.gain.linearRampToValueAtTime(0.56, startAt + 0.55)
  master.gain.setValueAtTime(0.58, introEnd)
  master.gain.linearRampToValueAtTime(0.68, liftAt)
  master.gain.linearRampToValueAtTime(0.77, liftAt + 0.42)
  master.gain.setValueAtTime(0.77, Math.max(liftAt + 0.42, outroAt - 0.2))
  master.gain.linearRampToValueAtTime(0.61, outroAt + 0.18)
  master.gain.setValueAtTime(0.61, startAt + musicalDuration - 0.32)
  master.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  scheduleAmbience(context, buses, noiseBuffer, startAt, musicalDuration, scene.ambience)
  scheduleSwell(context, buses, noiseBuffer, liftAt - beat * 0.85, beat * 0.85, 0.012)

  const scheduleLead = (frequency: number, noteStart: number, noteDuration: number, volume: number, pan: number) => {
    if (arrangement.lead === 'bell') {
      scheduleAcousticBell(context, buses, sampleBank, frequency, noteStart, noteDuration, volume * 0.7, pan)
    } else if (arrangement.lead === 'pluck') {
      scheduleAcousticGuitar(context, buses, sampleBank, noiseBuffer, frequency, noteStart, noteDuration, volume * 0.92, pan)
    } else {
      scheduleAcousticPiano(context, buses, sampleBank, frequency, noteStart, noteDuration, volume, pan)
    }
  }

  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const barStart = startAt + barIndex * bar
    const isIntro = barIndex < introBars
    const isLift = barIndex >= liftStart && barIndex < outroIndex
    const isOutro = barIndex === outroIndex
    const chordRoot = isOutro ? 0 : progression[barIndex % progression.length]
    const chordDegrees = isIntro
      ? [chordRoot, chordRoot + 4]
      : isLift
        ? [chordRoot, chordRoot + 2, chordRoot + 4, chordRoot + 6]
        : isOutro
          ? [0, 4]
          : [chordRoot, chordRoot + 2, chordRoot + 4]
    const dynamics = isIntro
      ? 0.62 + barIndex * 0.08
      : isLift
        ? 1.04
        : isOutro
          ? 0.68
          : 0.82 + (barIndex - introBars) / Math.max(1, liftStart - introBars) * 0.12

    chordDegrees.forEach((degree, noteIndex) => {
      const semitone = degreeSemitone(scale, degree)
      scheduleCelloLayer(
        context,
        buses,
        sampleBank,
        noteFrequency(root, semitone, -1),
        barStart + noteIndex * 0.014,
        isOutro ? bar + RELEASE_TAIL_SECONDS * 0.7 : bar * 0.96,
        (isLift ? 0.019 : 0.024) * dynamics,
        (noteIndex - (chordDegrees.length - 1) / 2) * 0.16,
        arrangement.pad === 'bowed',
      )
    })

    const rootSemitone = degreeSemitone(scale, chordRoot)
    if (!isIntro) {
      scheduleAcousticBass(
        context,
        buses,
        sampleBank,
        noteFrequency(root, rootSemitone, -2),
        barStart,
        isOutro ? beat * 3.5 : beat * 1.6,
        (isOutro ? 0.075 : 0.1) * dynamics,
      )
      if (!isOutro) {
        const secondBassDegree = isLift ? chordRoot + 4 : chordRoot
        scheduleAcousticBass(
          context,
          buses,
          sampleBank,
          noteFrequency(root, degreeSemitone(scale, secondBassDegree), -2),
          barStart + beat * 2,
          beat * 1.45,
          (isLift ? 0.085 : 0.072) * dynamics,
        )
      }
    }

    const arpeggioPattern = [0, 1, 2, 1, 0, 1, 2, 1]
    const arpeggioSteps = isOutro
      ? 0
      : isIntro
        ? 2
        : isJoyful
          ? 8
        : sparseness > 0.62
          ? isLift ? 4 : 2
          : isLift ? 8 : 4
    for (let step = 0; step < arpeggioSteps; step += 1) {
      const chordDegree = chordDegrees[arpeggioPattern[step] % chordDegrees.length]
      const semitone = degreeSemitone(scale, chordDegree)
      const gridStart = isIntro
        ? barStart + beat * (2 + step)
        : barStart + step * (bar / arpeggioSteps)
      const playingOffset = (seededUnit(seed ^ 0x4a17, barIndex * 37 + step) - 0.5) * 0.026
        + (arrangement.lead === 'pluck' && step % 2 === 1 ? 0.012 : 0)
      const noteStart = Math.max(barStart, gridStart + playingOffset)
      const humanVelocity = 0.92 + seededUnit(seed, barIndex * 31 + step) * 0.14
      if (arrangement.lead === 'pluck') {
        scheduleAcousticPiano(context, buses, sampleBank, noteFrequency(root, semitone, -1), noteStart, beat * 0.72, 0.016 * dynamics * humanVelocity, (step % 2 ? 0.2 : -0.2) * (1 + spaciousness * 0.7))
      } else {
        scheduleAcousticGuitar(context, buses, sampleBank, noiseBuffer, noteFrequency(root, semitone, -1), noteStart, beat * 0.62, 0.024 * dynamics * humanVelocity, (step % 2 ? 0.23 : -0.23) * (1 + spaciousness * 0.7))
      }
    }

    const isCadenceBar = barIndex === outroIndex - 1
    const developmentBar = Math.max(0, barIndex - introBars)
    const developedMotif = coreMotif.map((note, noteIndex) => ({
      ...note,
      degree: note.degree + (noteIndex === coreMotif.length - 1 ? (seed % 2 === 0 ? 1 : -1) : 0),
      at: note.at + (noteIndex === 0 ? 0.28 : 0),
    }))
    const liftedMotif = coreMotif.map((note, noteIndex) => ({
      ...note,
      degree: note.degree + (result.analysis.direction === 'falling' ? 0 : noteIndex % 2 === 0 ? 2 : 1),
      length: note.length * (noteIndex === coreMotif.length - 1 ? 1.28 : 0.92),
    }))
    const motif = isOutro
      ? [{ at: 0.35, degree: 4, length: 0.7 }, { at: 1.45, degree: 2, length: 0.72 }, { at: 2.62, degree: 0, length: 1.7 }]
      : isCadenceBar
        ? [{ at: 0, degree: 4, length: 0.78 }, { at: 1.05, degree: 2, length: 0.62 }, { at: 2.05, degree: 1, length: 0.62 }, { at: 3.05, degree: 0, length: 1.2 }]
        : isLift
          ? liftedMotif
          : developmentBar >= 2 && developmentBar % 4 >= 2
            ? developedMotif
            : coreMotif

    motif.forEach((note, noteIndex) => {
      if (isIntro && note.at < 2) return
      const timing = isOutro ? 0 : (seededUnit(seed, barIndex * 43 + noteIndex) - 0.5) * 0.042
      const noteStart = Math.max(barStart, barStart + note.at * beat + timing)
      const velocity = 0.91 + seededUnit(seed ^ 0x71c3, barIndex * 47 + noteIndex) * 0.17
      const octave = leadOctave + (isLift && noteIndex === 2 && arrangement.lead !== 'pluck' && result.analysis.valence >= -0.1 ? 1 : 0)
      const frequency = noteFrequency(root, degreeSemitone(scale, note.degree), octave)
      const pan = noteIndex % 2 ? 0.1 : -0.1
      const leadVolume = (arrangement.lead === 'piano' ? 0.048 : arrangement.lead === 'pluck' ? 0.044 : 0.036)
        * dynamics * velocity
      scheduleLead(frequency, noteStart, beat * note.length, leadVolume, pan)

      if (isLift && (noteIndex === 0 || noteIndex === 2)) {
        const harmonyFrequency = noteFrequency(root, degreeSemitone(scale, note.degree - 2), octave)
        if (arrangement.lead === 'pluck') {
          scheduleAcousticPiano(context, buses, sampleBank, harmonyFrequency, noteStart + 0.018, beat * note.length * 0.92, 0.014 * dynamics, -pan * 1.7)
        } else {
          scheduleAcousticGuitar(context, buses, sampleBank, noiseBuffer, harmonyFrequency, noteStart + 0.018, beat * note.length * 0.88, 0.016 * dynamics, -pan * 1.7)
        }
      }
    })

    if (isLift && !isOutro && result.analysis.dimensions.isolation < 0.62) {
      const counterDegree = chordRoot + (barIndex % 2 === 0 ? 4 : 2)
      const counterFrequency = noteFrequency(root, degreeSemitone(scale, counterDegree), -1)
      const counterStart = barStart + beat * (barIndex % 2 === 0 ? 1.45 : 2.25)
      if (arrangement.lead === 'piano') {
        scheduleAcousticGuitar(context, buses, sampleBank, noiseBuffer, counterFrequency, counterStart, beat * 1.25, 0.019, 0.34)
      } else {
        scheduleAcousticPiano(context, buses, sampleBank, counterFrequency, counterStart, beat * 1.4, 0.017, 0.34)
      }
    }

    if (arrangement.percussion !== 'none' && !isIntro && !isOutro) {
      const full = arrangement.percussion === 'full'
      scheduleRecordedKick(context, buses, sampleBank, barStart, full ? 0.115 : 0.07)
      if (isLift || barIndex % 2 === 0) scheduleRecordedKick(context, buses, sampleBank, barStart + beat * 2, full ? 0.095 : 0.052)
      if (full) {
        scheduleSnare(context, master, noiseBuffer, barStart + beat, 0.018)
        scheduleSnare(context, master, noiseBuffer, barStart + beat * 3, 0.016)
        scheduleRecordedWoodblock(context, buses, sampleBank, barStart + beat, 0.022, -0.12)
        scheduleRecordedWoodblock(context, buses, sampleBank, barStart + beat * 3, 0.019, 0.12)
      } else {
        scheduleRecordedShaker(context, buses, sampleBank, noiseBuffer, barStart + beat, 0.014, false, -0.18)
        scheduleRecordedShaker(context, buses, sampleBank, noiseBuffer, barStart + beat * 3, 0.012, true, 0.18)
      }
      if (full && (isLift || isJoyful)) {
        for (let step = 0; step < 8; step += 1) {
          scheduleRecordedShaker(
            context,
            buses,
            sampleBank,
            noiseBuffer,
            barStart + step * beat / 2,
            step % 2 ? 0.01 : 0.007,
            step % 2 === 1,
            step % 2 ? 0.22 : -0.22,
          )
        }
      }
    } else if (shouldUseRestrainedShaker(result, arrangement) && isLift) {
      scheduleRecordedShaker(context, buses, sampleBank, noiseBuffer, barStart + beat * 1.02, 0.012, false, -0.28)
      scheduleRecordedShaker(context, buses, sampleBank, noiseBuffer, barStart + beat * 3.02, 0.01, true, 0.28)
    }

    if (scene.transit && !isIntro && !isOutro && barIndex % 2 === 0) {
      scheduleRecordedWoodblock(context, buses, sampleBank, barStart + beat * 0.5, 0.021, -0.2)
      scheduleRecordedWoodblock(context, buses, sampleBank, barStart + beat * 2.5, 0.016, 0.2)
    }

    if (shouldUseCelestialAccents(result, scene) && !isIntro && !isOutro && barIndex % 2 === 1) {
      const starDegree = degreeSemitone(scale, barIndex + 4)
      scheduleAcousticBell(context, buses, sampleBank, noteFrequency(root, starDegree, 1), barStart + beat * 3.25, beat * 0.45, 0.01, 0.35)
    }

    if (scene.home && !isOutro && barIndex % 2 === 0) {
      const memoryDegree = degreeSemitone(scale, chordRoot + 4)
      scheduleAcousticGuitar(context, buses, sampleBank, noiseBuffer, noteFrequency(root, memoryDegree), barStart + beat * 3.5, beat * 0.42, 0.017, -0.32)
    }

    if (scene.water && !isIntro && !isOutro && barIndex % 3 === 1) {
      scheduleAcousticBell(context, buses, sampleBank, noteFrequency(root, degreeSemitone(scale, 4), -1), barStart + beat * 1.5, beat * 1.2, 0.009, -0.4)
    }

    if (spaciousness > 0.34 && !isIntro && !isOutro && barIndex % 2 === 0) {
      const openDegree = degreeSemitone(scale, chordRoot + 4)
      scheduleAcousticGuitar(
        context,
        buses,
        sampleBank,
        noiseBuffer,
        noteFrequency(root, openDegree, 1),
        barStart + beat * 3.38,
        beat * 0.56,
        0.011 + spaciousness * 0.007,
        barIndex % 4 === 0 ? -0.48 : 0.48,
      )
    }
  }

  return { master, duration }
}

export async function playSongPreview(
  result: SongResult,
  onEnded: () => void,
  signal?: AbortSignal,
): Promise<MusicHandle> {
  const context = new AudioContext()
  const closeOnAbort = () => {
    if (context.state !== 'closed') void context.close()
  }
  signal?.addEventListener('abort', closeOnAbort, { once: true })
  try {
    await context.resume()
    const sampleBank = await loadSampleBank()
    if (signal?.aborted) throw new DOMException('Audio preparation cancelled', 'AbortError')
    signal?.removeEventListener('abort', closeOnAbort)
    const { master, duration } = scheduleComposition(
      context,
      result,
      context.destination,
      context.currentTime + 0.08,
      sampleBank,
    )
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
  } catch (error) {
    signal?.removeEventListener('abort', closeOnAbort)
    if (context.state !== 'closed') void context.close()
    throw error
  }
}

function audioBufferToWav(buffer: AudioBuffer) {
  const channelCount = Math.min(2, buffer.numberOfChannels)
  const bytesPerSample = 2
  const frameCount = buffer.length
  const dataSize = frameCount * channelCount * bytesPerSample
  const output = new ArrayBuffer(44 + dataSize)
  const view = new DataView(output)
  const channels = Array.from({ length: channelCount }, (_, index) => buffer.getChannelData(index))

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * channelCount * bytesPerSample, true)
  view.setUint16(32, channelCount * bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += bytesPerSample
    }
  }
  return new Blob([output], { type: 'audio/wav' })
}

export async function renderSongPreviewWav(result: SongResult) {
  const duration = getSongPreviewDuration(result.mood.tempo)
  const sampleRate = 32_000
  const context = new OfflineAudioContext(2, Math.ceil((duration + 0.08) * sampleRate), sampleRate)
  const sampleBank = await loadSampleBank()
  scheduleComposition(
    context as unknown as AudioContext,
    result,
    context.destination,
    0.05,
    sampleBank,
  )
  const buffer = await context.startRendering()
  return audioBufferToWav(buffer)
}
