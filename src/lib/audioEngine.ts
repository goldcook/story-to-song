import type { MoodId, SongResult } from '../types'
import { hasAffirmedStoryTerm } from './storyEngine'
import {
  getStoryTasteTarget,
  scoreTasteFit,
  type DevelopmentStyle,
  type MusicTasteVector,
  type TextureStyle,
} from './musicTaste'

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

type SampleInstrument = 'piano' | 'guitar' | 'cello' | 'clarinet' | 'frameDrum' | 'frameMuted' | 'shakerUp' | 'shakerDown' | 'woodblock'

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

type CompositionSection = 'intro' | 'development' | 'turn' | 'climax' | 'outro'
type LeadInstrument = 'piano' | 'guitar' | 'clarinet'
type HarmonyInstrument = 'piano' | 'guitar' | 'cello'
type BassInstrument = 'none' | 'piano' | 'cello'
type PercussionStyle = 'none' | 'soft' | 'full' | 'restless'
type MotifFamily = 'recollecting' | 'buoyant' | 'descending' | 'rising' | 'restless' | 'gentle' | 'spacious'
type CadenceStyle = 'remembered' | 'lifted' | 'unresolved' | 'ascending' | 'suspended' | 'warm' | 'resting'

interface Arrangement {
  lead: LeadInstrument
  harmony: HarmonyInstrument
  bass: BassInstrument
  percussion: PercussionStyle
}

interface StoryScene {
  home: boolean
  transit: boolean
  celestial: boolean
  water: boolean
}

export interface ArrangementTrack {
  id: string
  label: string
  role: string
}

export interface CompositionPlan {
  mood: MoodId
  character: string
  lead: LeadInstrument
  harmony: HarmonyInstrument
  bass: BassInstrument
  percussion: PercussionStyle
  motifFamily: MotifFamily
  cadence: CadenceStyle
  progression: number[]
  arc: CompositionSection[]
  motifIndex: number
  developmentStyle: DevelopmentStyle
  textureStyle: TextureStyle
  leadOctave: number
  arpeggioSteps: number
  reverbSeconds: number
  reverbLevel: number
  reverbLowpass: number
  dynamics: Record<CompositionSection, number>
  candidateCount: number
  qualityScore: number
}

const ARRANGEMENT_BANKS: Record<MoodId, Arrangement[]> = {
  nostalgic: [
    { lead: 'guitar', harmony: 'cello', bass: 'cello', percussion: 'soft' },
    { lead: 'piano', harmony: 'guitar', bass: 'cello', percussion: 'soft' },
  ],
  joyful: [
    { lead: 'guitar', harmony: 'piano', bass: 'none', percussion: 'full' },
    { lead: 'piano', harmony: 'guitar', bass: 'none', percussion: 'full' },
  ],
  melancholy: [
    { lead: 'piano', harmony: 'cello', bass: 'cello', percussion: 'none' },
    { lead: 'guitar', harmony: 'cello', bass: 'cello', percussion: 'none' },
  ],
  hopeful: [
    { lead: 'piano', harmony: 'guitar', bass: 'piano', percussion: 'soft' },
    { lead: 'guitar', harmony: 'piano', bass: 'piano', percussion: 'soft' },
    { lead: 'piano', harmony: 'cello', bass: 'cello', percussion: 'soft' },
  ],
  tense: [
    { lead: 'guitar', harmony: 'piano', bass: 'cello', percussion: 'restless' },
    { lead: 'piano', harmony: 'cello', bass: 'cello', percussion: 'restless' },
  ],
  tender: [
    { lead: 'guitar', harmony: 'piano', bass: 'none', percussion: 'none' },
    { lead: 'piano', harmony: 'guitar', bass: 'none', percussion: 'none' },
  ],
  calm: [
    { lead: 'clarinet', harmony: 'guitar', bass: 'none', percussion: 'none' },
    { lead: 'guitar', harmony: 'piano', bass: 'none', percussion: 'none' },
  ],
}

function getArrangementBank(result: SongResult) {
  const bank = ARRANGEMENT_BANKS[result.mood.id]
  if (result.mood.id === 'hopeful' && result.analysis.dimensions.grief > 0.58) {
    return [bank[2], bank[0]]
  }
  return bank.filter(Boolean)
}

const PROGRESSION_BANKS: Record<MoodId, number[][]> = {
  nostalgic: [[0, 3, 5, 4, 0, 5, 3, 4], [0, 5, 3, 6, 0, 3, 4, 4]],
  joyful: [[0, 1, 3, 4, 0, 5, 1, 4], [0, 3, 1, 4, 5, 3, 1, 4]],
  melancholy: [[0, 5, 3, 6, 0, 5, 4, 4], [0, 3, 5, 4, 0, 6, 3, 4]],
  hopeful: [[0, 4, 5, 3, 1, 4, 3, 4], [0, 3, 5, 4, 1, 3, 4, 4]],
  tense: [[0, 1, 0, 5, 1, 6, 1, 4], [0, 5, 1, 0, 6, 1, 5, 4]],
  tender: [[0, 3, 1, 4, 0, 1, 3, 4], [0, 4, 1, 3, 0, 3, 1, 4]],
  calm: [[0, 3, 1, 0, 4, 1, 3, 0], [0, 1, 3, 0, 1, 4, 3, 0]],
}

const PLAN_CHARACTER: Record<MoodId, string> = {
  nostalgic: '旧照片般的回望与弓弦余韵',
  joyful: '短促跳跃的旋律与明亮重拍',
  melancholy: '缓慢下行的钢琴与低弓长线',
  hopeful: '从低处逐步展开的明亮主题',
  tense: '不规则木质脉冲与悬而未决的低音',
  tender: '近距离的旋律与柔软回应',
  calm: '有呼吸间隔的旋律与开放拨弦',
}

const MOTIF_FAMILIES: Record<MoodId, MotifFamily> = {
  nostalgic: 'recollecting',
  joyful: 'buoyant',
  melancholy: 'descending',
  hopeful: 'rising',
  tense: 'restless',
  tender: 'gentle',
  calm: 'spacious',
}

const CADENCE_BANKS: Record<MoodId, CadenceStyle[]> = {
  nostalgic: ['remembered', 'warm'],
  joyful: ['lifted', 'ascending'],
  melancholy: ['unresolved', 'remembered'],
  hopeful: ['ascending', 'lifted'],
  tense: ['suspended', 'unresolved'],
  tender: ['warm'],
  calm: ['resting'],
}

const PLAN_DYNAMICS: Record<MoodId, Record<CompositionSection, number>> = {
  nostalgic: { intro: 0.5, development: 0.72, turn: 0.58, climax: 0.86, outro: 0.46 },
  joyful: { intro: 0.72, development: 0.92, turn: 0.8, climax: 1.08, outro: 0.9 },
  melancholy: { intro: 0.42, development: 0.58, turn: 0.46, climax: 0.74, outro: 0.34 },
  hopeful: { intro: 0.48, development: 0.72, turn: 0.62, climax: 1, outro: 0.78 },
  tense: { intro: 0.62, development: 0.9, turn: 0.5, climax: 1.14, outro: 0.44 },
  tender: { intro: 0.46, development: 0.64, turn: 0.55, climax: 0.76, outro: 0.5 },
  calm: { intro: 0.38, development: 0.5, turn: 0.42, climax: 0.58, outro: 0.4 },
}

const COMPOSITION_PLAN_CACHE = new WeakMap<SongResult, CompositionPlan>()

interface TextureProfile {
  arpeggioDelta: number
  dynamicScale: number
  reverbSecondsDelta: number
  reverbLevelDelta: number
  reverbLowpassDelta: number
}

const TEXTURE_PROFILES: Record<TextureStyle, TextureProfile> = {
  intimate: { arpeggioDelta: -2, dynamicScale: 0.68, reverbSecondsDelta: -0.18, reverbLevelDelta: -0.04, reverbLowpassDelta: -520 },
  flowing: { arpeggioDelta: 0, dynamicScale: 1, reverbSecondsDelta: 0, reverbLevelDelta: 0, reverbLowpassDelta: 0 },
  driving: { arpeggioDelta: 2, dynamicScale: 1.34, reverbSecondsDelta: -0.12, reverbLevelDelta: -0.02, reverbLowpassDelta: 620 },
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
  { instrument: 'clarinet', path: 'clarinet/D3.mp3', rootMidi: 50, level: 0.78 },
  { instrument: 'clarinet', path: 'clarinet/As3.mp3', rootMidi: 58, level: 0.82 },
  { instrument: 'clarinet', path: 'clarinet/F4.mp3', rootMidi: 65, level: 0.8 },
  { instrument: 'clarinet', path: 'clarinet/As4.mp3', rootMidi: 70, level: 0.76 },
  { instrument: 'clarinet', path: 'clarinet/D5.mp3', rootMidi: 74, level: 0.72 },
  { instrument: 'frameDrum', path: '../percussion/frame-drum-hand.wav', rootMidi: 69, level: 0.74 },
  { instrument: 'frameMuted', path: '../percussion/frame-drum-muted.wav', rootMidi: 69, level: 0.68 },
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
      clarinet: [],
      frameDrum: [],
      frameMuted: [],
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

function getStoryScene(story: string): StoryScene {
  const includes = (...terms: string[]) => hasAffirmedStoryTerm(story, terms)
  const home = includes('外婆', '爷爷', '奶奶', '妈妈', '爸爸', '家人', '回家', '院子', '故乡')
  const transit = includes('火车', '地铁', '车站', '站台', '公路', '开车', '城市', '出发')
  const celestial = includes('夜晚', '夏夜', '凌晨', '星星', '星空', '月亮', '月光')
  const water = includes('大海', '海面', '海边', '湖边', '河边', '浪花', '海风')
  return {
    home,
    transit,
    celestial,
    water,
  }
}

function shouldUseNightBreath(result: SongResult, scene: StoryScene) {
  const { calm, hope, nostalgia, tenderness } = result.analysis.dimensions
  return scene.celestial && calm + hope + nostalgia + tenderness > 0.58
}

function shouldUseRestrainedShaker(result: SongResult, arrangement: Arrangement) {
  const { grief, isolation, hope, agency } = result.analysis.dimensions
  return arrangement.percussion === 'none'
    && hope + agency > 0.72
    && grief + isolation < 0.58
}

export function getArrangementTracks(result: SongResult): ArrangementTrack[] {
  const plan = getCompositionPlan(result)
  const scene = getStoryScene(result.story)
  const leadNames: Record<LeadInstrument, string> = { piano: '实录柔音钢琴', guitar: '实录原声吉他', clarinet: '实录单簧管' }
  const harmonyNames: Record<HarmonyInstrument, string> = { piano: '明亮钢琴和声', guitar: '原声吉他织体', cello: '大提琴弓弦层' }
  const tracks: ArrangementTrack[] = [
    { id: 'lead', label: leadNames[plan.lead], role: '主题旋律' },
    { id: 'harmony', label: harmonyNames[plan.harmony], role: '情绪和声' },
  ]

  if (plan.bass !== 'none') {
    tracks.push({
      id: 'bass',
      label: plan.bass === 'cello' ? '大提琴低音' : '低音钢琴',
      role: '低频叙事线',
    })
  }

  if (result.analysis.dimensions.isolation < 0.62) {
    tracks.push({
      id: 'counterline',
      label: plan.lead === 'piano' ? '原声吉他回应' : '柔音钢琴回应',
      role: '高潮段变奏',
    })
  }

  if (plan.percussion !== 'none') {
    tracks.push({
      id: 'rhythm',
      label: plan.percussion === 'full'
        ? '实录框鼓、木块与沙锤'
        : plan.percussion === 'restless'
          ? '实录框鼓与错位木击'
          : '实录轻打击乐',
      role: '节奏脉冲',
    })
  }
  if (scene.home) tracks.push({ id: 'memory', label: '原声吉他泛音', role: '家的记忆' })
  if (scene.transit) tracks.push({ id: 'transit', label: '木质移动节拍', role: '旅途推进' })
  if (shouldUseNightBreath(result, scene) || scene.water) {
    tracks.push({ id: 'breath', label: '单簧管长音', role: scene.water ? '水面远景' : '夜色呼吸' })
  }
  if (result.analysis.dimensions.openness > 0.34) tracks.push({ id: 'openness', label: '开阔吉他泛音', role: '自由与远方' })
  if (result.analysis.dimensions.isolation > 0.46) tracks.push({ id: 'silence', label: '低音留白', role: '孤独与停顿' })
  if (shouldUseRestrainedShaker(result, plan)) tracks.push({ id: 'brush', label: '实录细沙锤', role: '克制律动' })
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

interface MotifNote {
  at: number
  degree: number
  length: number
}

const MOTIF_BANKS: Record<MotifFamily, MotifNote[][]> = {
  recollecting: [
    [{ at: 0.08, degree: 4, length: 0.66 }, { at: 1.04, degree: 2, length: 0.54 }, { at: 2.08, degree: 3, length: 0.72 }, { at: 3.18, degree: 1, length: 0.88 }],
    [{ at: 0.16, degree: 2, length: 0.62 }, { at: 1.14, degree: 4, length: 0.7 }, { at: 2.26, degree: 3, length: 0.58 }, { at: 3.2, degree: 0, length: 0.94 }],
  ],
  buoyant: [
    [{ at: 0, degree: 0, length: 0.28 }, { at: 0.46, degree: 2, length: 0.24 }, { at: 0.94, degree: 4, length: 0.3 }, { at: 1.52, degree: 5, length: 0.24 }, { at: 2.02, degree: 4, length: 0.28 }, { at: 2.54, degree: 6, length: 0.24 }, { at: 3.06, degree: 7, length: 0.56 }],
    [{ at: 0.12, degree: 2, length: 0.26 }, { at: 0.58, degree: 4, length: 0.28 }, { at: 1.06, degree: 5, length: 0.24 }, { at: 1.48, degree: 4, length: 0.28 }, { at: 2.06, degree: 2, length: 0.26 }, { at: 2.58, degree: 4, length: 0.28 }, { at: 3.14, degree: 6, length: 0.5 }],
    [{ at: 0, degree: 4, length: 0.24 }, { at: 0.4, degree: 5, length: 0.24 }, { at: 0.84, degree: 6, length: 0.3 }, { at: 1.46, degree: 4, length: 0.26 }, { at: 1.94, degree: 2, length: 0.3 }, { at: 2.52, degree: 5, length: 0.3 }, { at: 3.08, degree: 7, length: 0.58 }],
  ],
  descending: [
    [{ at: 0.12, degree: 5, length: 0.86 }, { at: 1.24, degree: 4, length: 0.68 }, { at: 2.28, degree: 2, length: 0.82 }, { at: 3.4, degree: 1, length: 1.18 }],
    [{ at: 0.24, degree: 4, length: 0.76 }, { at: 1.3, degree: 3, length: 0.76 }, { at: 2.38, degree: 1, length: 0.94 }, { at: 3.5, degree: 0, length: 1.2 }],
  ],
  rising: [
    [{ at: 0, degree: 0, length: 0.46 }, { at: 0.72, degree: 1, length: 0.42 }, { at: 1.42, degree: 3, length: 0.52 }, { at: 2.26, degree: 4, length: 0.6 }, { at: 3.18, degree: 6, length: 0.74 }],
    [{ at: 0.12, degree: 1, length: 0.44 }, { at: 0.82, degree: 2, length: 0.42 }, { at: 1.5, degree: 4, length: 0.54 }, { at: 2.38, degree: 5, length: 0.56 }, { at: 3.22, degree: 7, length: 0.72 }],
  ],
  restless: [
    [{ at: 0, degree: 0, length: 0.28 }, { at: 0.52, degree: 4, length: 0.3 }, { at: 1.14, degree: 1, length: 0.24 }, { at: 1.7, degree: 5, length: 0.32 }, { at: 2.46, degree: 2, length: 0.24 }, { at: 2.92, degree: 6, length: 0.28 }, { at: 3.48, degree: 1, length: 0.4 }],
    [{ at: 0.16, degree: 5, length: 0.26 }, { at: 0.64, degree: 1, length: 0.3 }, { at: 1.38, degree: 6, length: 0.26 }, { at: 1.9, degree: 2, length: 0.3 }, { at: 2.68, degree: 5, length: 0.24 }, { at: 3.12, degree: 1, length: 0.42 }],
  ],
  gentle: [
    [{ at: 0.18, degree: 0, length: 0.62 }, { at: 1.12, degree: 2, length: 0.5 }, { at: 2.12, degree: 4, length: 0.7 }, { at: 3.24, degree: 2, length: 0.82 }],
    [{ at: 0.1, degree: 2, length: 0.58 }, { at: 1.06, degree: 1, length: 0.56 }, { at: 2.08, degree: 3, length: 0.7 }, { at: 3.22, degree: 4, length: 0.78 }],
  ],
  spacious: [
    [{ at: 0.28, degree: 0, length: 1.12 }, { at: 1.92, degree: 3, length: 0.92 }, { at: 3.28, degree: 2, length: 1.18 }],
    [{ at: 0.18, degree: 2, length: 1.02 }, { at: 1.82, degree: 4, length: 0.9 }, { at: 3.22, degree: 1, length: 1.22 }],
  ],
}

const CADENCE_MOTIFS: Record<CadenceStyle, { approach: MotifNote[]; outro: MotifNote[]; finalChord: number }> = {
  remembered: {
    approach: [{ at: 0.1, degree: 4, length: 0.7 }, { at: 1.18, degree: 3, length: 0.62 }, { at: 2.18, degree: 2, length: 0.72 }, { at: 3.22, degree: 0, length: 1.02 }],
    outro: [{ at: 0.42, degree: 4, length: 0.76 }, { at: 1.58, degree: 2, length: 0.82 }, { at: 2.84, degree: 0, length: 1.5 }],
    finalChord: 0,
  },
  lifted: {
    approach: [{ at: 0, degree: 2, length: 0.3 }, { at: 0.52, degree: 4, length: 0.3 }, { at: 1.08, degree: 5, length: 0.34 }, { at: 1.72, degree: 6, length: 0.34 }, { at: 2.36, degree: 7, length: 0.88 }],
    outro: [{ at: 0, degree: 4, length: 0.32 }, { at: 0.58, degree: 5, length: 0.3 }, { at: 1.16, degree: 6, length: 0.36 }, { at: 1.86, degree: 7, length: 1.62 }],
    finalChord: 0,
  },
  unresolved: {
    approach: [{ at: 0.2, degree: 5, length: 0.82 }, { at: 1.38, degree: 4, length: 0.72 }, { at: 2.5, degree: 2, length: 1.12 }],
    outro: [{ at: 0.46, degree: 4, length: 0.86 }, { at: 1.72, degree: 2, length: 0.92 }, { at: 3.04, degree: 2, length: 1.42 }],
    finalChord: 0,
  },
  ascending: {
    approach: [{ at: 0.08, degree: 1, length: 0.5 }, { at: 0.9, degree: 3, length: 0.5 }, { at: 1.76, degree: 4, length: 0.58 }, { at: 2.7, degree: 6, length: 0.98 }],
    outro: [{ at: 0.22, degree: 2, length: 0.5 }, { at: 1.08, degree: 4, length: 0.56 }, { at: 2.04, degree: 6, length: 0.62 }, { at: 3.08, degree: 7, length: 1.4 }],
    finalChord: 0,
  },
  suspended: {
    approach: [{ at: 0, degree: 1, length: 0.34 }, { at: 0.62, degree: 5, length: 0.32 }, { at: 1.34, degree: 2, length: 0.36 }, { at: 2.12, degree: 6, length: 0.34 }, { at: 2.84, degree: 1, length: 0.92 }],
    outro: [{ at: 0.16, degree: 5, length: 0.4 }, { at: 0.86, degree: 1, length: 0.4 }, { at: 1.62, degree: 6, length: 0.46 }, { at: 2.52, degree: 1, length: 1.5 }],
    finalChord: 1,
  },
  warm: {
    approach: [{ at: 0.18, degree: 2, length: 0.62 }, { at: 1.18, degree: 4, length: 0.62 }, { at: 2.18, degree: 3, length: 0.68 }, { at: 3.22, degree: 2, length: 0.94 }],
    outro: [{ at: 0.36, degree: 4, length: 0.74 }, { at: 1.5, degree: 2, length: 0.8 }, { at: 2.74, degree: 0, length: 1.58 }],
    finalChord: 0,
  },
  resting: {
    approach: [{ at: 0.34, degree: 3, length: 1.08 }, { at: 2.04, degree: 2, length: 0.94 }, { at: 3.46, degree: 0, length: 1.08 }],
    outro: [{ at: 0.52, degree: 4, length: 1.08 }, { at: 2.12, degree: 2, length: 0.92 }, { at: 3.46, degree: 0, length: 1.4 }],
    finalChord: 0,
  },
}

interface ScoredCompositionCandidate {
  arrangementIndex: number
  progressionIndex: number
  motifIndex: number
  developmentStyle: DevelopmentStyle
  textureStyle: TextureStyle
  cadence: CadenceStyle
  score: number
}

const DEVELOPMENT_STYLES: DevelopmentStyle[] = ['echo', 'answer', 'expansion']
const TEXTURE_STYLES: TextureStyle[] = ['intimate', 'flowing', 'driving']

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length)
}

function getTexturedDynamics(
  dynamics: Record<CompositionSection, number>,
  textureStyle: TextureStyle,
) {
  const values = Object.values(dynamics)
  const center = average(values)
  const scale = TEXTURE_PROFILES[textureStyle].dynamicScale
  return Object.fromEntries(
    Object.entries(dynamics).map(([section, value]) => [
      section,
      clamp(center + (value - center) * scale, 0.28, 1.16),
    ]),
  ) as Record<CompositionSection, number>
}

function getCandidateVector(
  result: SongResult,
  arrangement: Arrangement,
  progression: number[],
  motif: MotifNote[],
  cadence: CadenceStyle,
  developmentStyle: DevelopmentStyle,
  arpeggioSteps: number,
  reverbLowpass: number,
  dynamics: Record<CompositionSection, number>,
): MusicTasteVector {
  const degrees = motif.map((note) => note.degree)
  const intervals = degrees.slice(1).map((degree, index) => degree - degrees[index])
  const rhythmActivity = arrangement.percussion === 'full'
    ? 0.82
    : arrangement.percussion === 'restless'
      ? 0.94
      : arrangement.percussion === 'soft' ? 0.38 : 0.1
  const offBeatRatio = motif.filter((note) => Math.abs(note.at - Math.round(note.at)) > 0.2).length / motif.length
  const instrumentBrightness = {
    piano: 0.65,
    guitar: 0.78,
    clarinet: 0.52,
    cello: 0.26,
  }
  const cadenceClosure: Record<CadenceStyle, number> = {
    remembered: 0.72,
    lifted: 0.98,
    unresolved: 0.46,
    ascending: 0.94,
    suspended: 0.08,
    warm: 0.88,
    resting: 0.92,
  }
  const cadenceTension: Record<CadenceStyle, number> = {
    remembered: 0.28,
    lifted: 0.12,
    unresolved: 0.48,
    ascending: 0.16,
    suspended: 0.96,
    warm: 0.1,
    resting: 0.06,
  }
  const harmonicDistances = progression.slice(1).map((degree, index) => {
    const difference = Math.abs(degree - progression[index])
    const scaleLength = SCALE_STEPS[result.mood.scale].length
    return Math.min(difference, scaleLength - difference)
  })
  const maximumDegree = Math.max(...degrees)
  const minimumDegree = Math.min(...degrees)
  const averageLength = average(motif.map((note) => note.length))
  const dynamicValues = Object.values(dynamics)
  const variationAdjustments: Record<DevelopmentStyle, Partial<MusicTasteVector>> = {
    echo: { density: -0.03, syncopation: -0.02, sustain: 0.08, closure: 0.03 },
    answer: { density: 0.04, syncopation: 0.12, upwardContour: -0.04, tension: 0.06 },
    expansion: { density: 0.06, upwardContour: 0.14, pitchRange: 0.12, dynamicContrast: 0.08 },
  }
  const variation = variationAdjustments[developmentStyle]
  const baseVector: MusicTasteVector = {
    density: clamp(motif.length / 7 * 0.58 + arpeggioSteps / 8 * 0.42, 0, 1),
    syncopation: clamp(rhythmActivity * 0.72 + offBeatRatio * 0.28, 0, 1),
    upwardContour: clamp(0.5 + (degrees.at(-1)! - degrees[0]) / 12, 0, 1),
    pitchRange: clamp((maximumDegree - minimumDegree) / 7, 0, 1),
    sustain: clamp(averageLength / 1.05, 0, 1),
    harmonicMotion: clamp(average(harmonicDistances) / 3.2, 0, 1),
    brightness: clamp(
      instrumentBrightness[arrangement.lead] * 0.48
        + instrumentBrightness[arrangement.harmony] * 0.28
        + (reverbLowpass - 3600) / 5000 * 0.16
        + (arrangement.bass === 'cello' ? 0 : 0.08),
      0,
      1,
    ),
    tension: clamp(
      cadenceTension[cadence] * 0.62
        + (result.mood.scale === 'minor' ? 0.12 : 0)
        + average(intervals.map((interval) => Math.min(1, Math.abs(interval) / 5))) * 0.26,
      0,
      1,
    ),
    closure: cadenceClosure[cadence],
    dynamicContrast: clamp((Math.max(...dynamicValues) - Math.min(...dynamicValues)) / 0.82, 0, 1),
  }
  return Object.fromEntries(
    Object.entries(baseVector).map(([key, value]) => [
      key,
      clamp(value + (variation[key as keyof MusicTasteVector] ?? 0), 0, 1),
    ]),
  ) as unknown as MusicTasteVector
}

function getMelodicClichePenalty(motif: MotifNote[]) {
  const intervals = motif.slice(1).map((note, index) => note.degree - motif[index].degree)
  const fingerprint = intervals.join(',')
  const commonFragments = ['1,1,1', '2,2,2', '2,-2,2', '1,-1,1', '-1,-1,-1']
  const familiar = commonFragments.some((fragment) => fingerprint.includes(fragment)) ? 0.12 : 0
  const uniqueIntervals = new Set(intervals).size / Math.max(1, intervals.length)
  const repetitive = uniqueIntervals < 0.42 ? 0.1 : 0
  const excessiveLeaps = intervals.filter((interval) => Math.abs(interval) > 4).length / Math.max(1, intervals.length) * 0.08
  return familiar + repetitive + excessiveLeaps
}

function selectCompositionCandidate(
  result: SongResult,
  baseArpeggioSteps: number,
  baseReverbLowpass: number,
) {
  const motifFamily = MOTIF_FAMILIES[result.mood.id]
  const motifBank = MOTIF_BANKS[motifFamily]
  const progressionBank = PROGRESSION_BANKS[result.mood.id]
  const arrangementBank = getArrangementBank(result)
  const cadenceBank = CADENCE_BANKS[result.mood.id]
  const target = getStoryTasteTarget(result.mood.id, result.analysis)
  const candidates: ScoredCompositionCandidate[] = []

  arrangementBank.forEach((arrangement, arrangementIndex) => {
    progressionBank.forEach((progression, progressionIndex) => {
      motifBank.forEach((motif, motifIndex) => {
        DEVELOPMENT_STYLES.forEach((developmentStyle) => {
          TEXTURE_STYLES.forEach((textureStyle) => {
            cadenceBank.forEach((cadence) => {
              const texture = TEXTURE_PROFILES[textureStyle]
              const arpeggioSteps = clamp(baseArpeggioSteps + texture.arpeggioDelta, 2, 8)
              const reverbLowpass = clamp(baseReverbLowpass + texture.reverbLowpassDelta, 2800, 9200)
              const dynamics = getTexturedDynamics(PLAN_DYNAMICS[result.mood.id], textureStyle)
              const vector = getCandidateVector(
                result,
                arrangement,
                progression,
                motif,
                cadence,
                developmentStyle,
                arpeggioSteps,
                reverbLowpass,
                dynamics,
              )
              const score = scoreTasteFit(vector, target) - getMelodicClichePenalty(motif)
              candidates.push({
                arrangementIndex,
                progressionIndex,
                motifIndex,
                developmentStyle,
                textureStyle,
                cadence,
                score,
              })
            })
          })
        })
      })
    })
  })

  candidates.sort((a, b) => b.score - a.score)
  return { selected: candidates[0], candidateCount: candidates.length }
}

export function getCompositionArc(tempo: number, shortIntro = false): CompositionSection[] {
  const bars = previewBars(tempo)
  const introBars = shortIntro ? 1 : bars >= 10 ? 2 : 1
  const outroIndex = bars - 1
  const turnStart = Math.max(introBars + 1, Math.floor(bars * 0.45))
  const climaxStart = Math.max(turnStart + 1, Math.floor(bars * 0.68))
  return Array.from({ length: bars }, (_, barIndex) => {
    if (barIndex < introBars) return 'intro'
    if (barIndex === outroIndex) return 'outro'
    if (barIndex >= climaxStart) return 'climax'
    if (barIndex >= turnStart && barIndex < climaxStart) return 'turn'
    return 'development'
  })
}

function getMoodCompositionArc(tempo: number, mood: MoodId) {
  const bars = previewBars(tempo)
  const introBars = mood === 'joyful' || mood === 'tense' || mood === 'hopeful'
    ? 1
    : bars >= 7 ? 2 : 1
  const outroIndex = bars - 1
  const turnRatio = mood === 'tense' ? 0.38 : mood === 'joyful' ? 0.52 : mood === 'hopeful' ? 0.44 : 0.48
  const climaxRatio = mood === 'tense' ? 0.62 : mood === 'calm' ? 0.76 : mood === 'melancholy' ? 0.7 : 0.66
  const turnStart = Math.max(introBars + 1, Math.floor(bars * turnRatio))
  const climaxStart = Math.max(turnStart + 1, Math.floor(bars * climaxRatio))
  return Array.from({ length: bars }, (_, barIndex): CompositionSection => {
    if (barIndex < introBars) return 'intro'
    if (barIndex === outroIndex) return 'outro'
    if (barIndex >= climaxStart) return 'climax'
    if (barIndex >= turnStart) return 'turn'
    return 'development'
  })
}

export function getCompositionPlan(result: SongResult): CompositionPlan {
  const cached = COMPOSITION_PLAN_CACHE.get(result)
  if (cached) return cached
  const mood = result.mood.id
  const reverb = {
    nostalgic: [1.3, 0.16, 4700],
    joyful: [0.78, 0.08, 7800],
    melancholy: [1.55, 0.2, 3900],
    hopeful: [1, 0.12, 6800],
    tense: [0.68, 0.07, 6100],
    tender: [1.08, 0.13, 6200],
    calm: [1.62, 0.18, 5400],
  } satisfies Record<MoodId, [number, number, number]>
  const arpeggioSteps: Record<MoodId, number> = {
    nostalgic: 4,
    joyful: 8,
    melancholy: 2,
    hopeful: 6,
    tense: 6,
    tender: 4,
    calm: 2,
  }
  const leadOctave = mood === 'joyful'
    ? 1
    : mood === 'melancholy' && result.analysis.dimensions.grief + result.analysis.dimensions.isolation > 0.72
      ? -1
      : 0
  const [baseReverbSeconds, baseReverbLevel, baseReverbLowpass] = reverb[mood]
  const progressionBank = PROGRESSION_BANKS[mood]
  const arrangementBank = getArrangementBank(result)
  const candidateResult = selectCompositionCandidate(result, arpeggioSteps[mood], baseReverbLowpass)
  const { selected } = candidateResult
  const texture = TEXTURE_PROFILES[selected.textureStyle]
  const plan: CompositionPlan = {
    mood,
    character: PLAN_CHARACTER[mood],
    ...arrangementBank[selected.arrangementIndex],
    motifFamily: MOTIF_FAMILIES[mood],
    cadence: selected.cadence,
    progression: progressionBank[selected.progressionIndex],
    arc: getMoodCompositionArc(result.mood.tempo, mood),
    motifIndex: selected.motifIndex,
    developmentStyle: selected.developmentStyle,
    textureStyle: selected.textureStyle,
    leadOctave,
    arpeggioSteps: clamp(arpeggioSteps[mood] + texture.arpeggioDelta, 2, 8),
    reverbSeconds: clamp(baseReverbSeconds + texture.reverbSecondsDelta, 0.5, 2),
    reverbLevel: clamp(baseReverbLevel + texture.reverbLevelDelta, 0.04, 0.24),
    reverbLowpass: clamp(baseReverbLowpass + texture.reverbLowpassDelta, 2800, 9200),
    dynamics: getTexturedDynamics(PLAN_DYNAMICS[mood], selected.textureStyle),
    candidateCount: candidateResult.candidateCount,
    qualityScore: Math.round(clamp(selected.score, 0, 1) * 100),
  }
  COMPOSITION_PLAN_CACHE.set(result, plan)
  return plan
}

function normalizedDegree(degree: number, scaleLength: number) {
  return ((degree % scaleLength) + scaleLength) % scaleLength
}

function isChordTone(degree: number, chordDegrees: number[], scaleLength: number) {
  const normalized = normalizedDegree(degree, scaleLength)
  return chordDegrees.some((chordDegree) => normalizedDegree(chordDegree, scaleLength) === normalized)
}

function nearestChordDegree(degree: number, chordDegrees: number[], scaleLength: number) {
  const candidates = chordDegrees.flatMap((chordDegree) => [chordDegree - scaleLength, chordDegree, chordDegree + scaleLength])
  return candidates.reduce((closest, candidate) => (
    Math.abs(candidate - degree) < Math.abs(closest - degree) ? candidate : closest
  ))
}

export function fitMotifToChord(motif: MotifNote[], chordDegrees: number[], scaleLength: number): MotifNote[] {
  const fitted = motif.map((note) => {
    const beatPosition = ((note.at % 4) + 4) % 4
    const onStrongBeat = Math.min(beatPosition, Math.abs(beatPosition - 2), Math.abs(beatPosition - 4)) <= 0.24
    if (!onStrongBeat) return { ...note }
    return { ...note, degree: nearestChordDegree(note.degree, chordDegrees, scaleLength) }
  })

  return fitted.map((note, index) => {
    if (isChordTone(note.degree, chordDegrees, scaleLength)) return note
    const next = fitted[index + 1]
    const resolvesByStep = next
      && isChordTone(next.degree, chordDegrees, scaleLength)
      && Math.abs(next.degree - note.degree) <= 1
    return resolvesByStep ? note : { ...note, degree: nearestChordDegree(note.degree, chordDegrees, scaleLength) }
  })
}

function voiceLeadChord(chordRoot: number, previous: number[] | null, scaleLength: number) {
  const inversions = [
    [chordRoot, chordRoot + 2, chordRoot + 4],
    [chordRoot + 2, chordRoot + 4, chordRoot + scaleLength],
    [chordRoot + 4, chordRoot + scaleLength, chordRoot + scaleLength + 2],
  ]
  const candidates = inversions.flatMap((voicing) => [-scaleLength, 0, scaleLength].map((shift) => (
    voicing.map((degree) => degree + shift)
  )))
  return candidates.reduce((best, candidate) => {
    const score = previous
      ? candidate.reduce((total, degree, index) => total + Math.abs(degree - previous[index]), 0)
      : Math.abs(candidate.reduce((total, degree) => total + degree, 0) / candidate.length - 4)
    const bestScore = previous
      ? best.reduce((total, degree, index) => total + Math.abs(degree - previous[index]), 0)
      : Math.abs(best.reduce((total, degree) => total + degree, 0) / best.length - 4)
    return score < bestScore ? candidate : best
  })
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
  const naturalTail = instrument === 'cello'
    ? 0.55
    : instrument === 'piano'
      ? 0.72
      : instrument === 'clarinet'
        ? 0.32
        : 0.42
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
  instrument: 'frameDrum' | 'frameMuted' | 'shakerUp' | 'shakerDown' | 'woodblock',
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

function createReverb(
  context: AudioContext,
  destination: AudioNode,
  seed: number,
  duration: number,
  level: number,
  lowpass: number,
) {
  const convolver = context.createConvolver()
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
  returnFilter.frequency.value = lowpass
  returnGain.gain.value = level
  convolver.connect(returnFilter)
  returnFilter.connect(returnGain)
  returnGain.connect(destination)
  return convolver
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
  return Boolean(sampleBank && scheduleSampledVoice(
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
  ))
}

function scheduleAcousticGuitar(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  pan = 0,
) {
  return Boolean(sampleBank && scheduleSampledVoice(
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
  ))
}

function scheduleAcousticClarinet(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  pan = 0,
) {
  return Boolean(sampleBank && scheduleSampledVoice(
    context,
    buses,
    sampleBank,
    'clarinet',
    frequency,
    start,
    duration,
    volume * 1.08,
    pan,
    { attack: 0.065, release: 0.24, dry: 0.9, wet: 0.24, lowpass: 5200 },
  ))
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
  return Boolean(sampleBank && scheduleSampledVoice(
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
  ))
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
  return Boolean(sampleBank && scheduleSampledVoice(
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
  ))
}

function schedulePianoBass(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
) {
  return Boolean(sampleBank && scheduleSampledVoice(
    context,
    buses,
    sampleBank,
    'piano',
    frequency,
    start,
    duration,
    volume,
    0,
    { attack: 0.012, release: 0.32, dry: 0.97, wet: 0.08, lowpass: 1800 },
  ))
}

function scheduleFrameDrum(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  start: number,
  volume: number,
  muted = false,
) {
  return scheduleSampledOneShot(
    context,
    buses,
    sampleBank,
    muted ? 'frameMuted' : 'frameDrum',
    start,
    volume * (muted ? 1.08 : 1.18),
    0,
    { dry: 0.96, wet: 0.12, maxDuration: muted ? 0.48 : 0.9, lowpass: 4200 },
  )
}

function scheduleRecordedShaker(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  start: number,
  volume: number,
  upStroke: boolean,
  pan: number,
) {
  return scheduleSampledOneShot(
    context,
    buses,
    sampleBank,
    upStroke ? 'shakerUp' : 'shakerDown',
    start,
    volume * 1.55,
    pan,
    { dry: 0.88, wet: 0.18, maxDuration: upStroke ? 0.24 : 0.42, lowpass: 8200 },
  )
}

function scheduleRecordedWoodblock(
  context: AudioContext,
  buses: AudioBuses,
  sampleBank: SampleBank | undefined,
  start: number,
  volume: number,
  pan = 0,
) {
  return scheduleSampledOneShot(
    context,
    buses,
    sampleBank,
    'woodblock',
    start,
    volume * 1.28,
    pan,
    { dry: 0.9, wet: 0.16, maxDuration: 0.62, playbackRate: 0.96, lowpass: 6600 },
  )
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
    curve[index] = Math.tanh(value * 1.06)
  }
  saturation.curve = curve
  saturation.oversample = '2x'
  compressor.threshold.value = -12
  compressor.knee.value = 14
  compressor.ratio.value = 1.65
  compressor.attack.value = 0.025
  compressor.release.value = 0.34
  output.gain.value = 4.8
  master.connect(saturation)
  saturation.connect(compressor)
  compressor.connect(output)
  output.connect(destination)

  const plan = getCompositionPlan(result)
  const reverb = createReverb(
    context,
    master,
    seed ^ 0x51f15e,
    plan.reverbSeconds,
    plan.reverbLevel,
    plan.reverbLowpass,
  )
  const buses: AudioBuses = { dry: master, reverb }
  const scene = getStoryScene(result.story)
  const beat = 60 / result.mood.tempo
  const bar = beat * 4
  const bars = previewBars(result.mood.tempo)
  const musicalDuration = bars * bar
  const duration = musicalDuration + RELEASE_TAIL_SECONDS
  const root = rootFrequency(result.mood.key)
  const scale = SCALE_STEPS[result.mood.scale]
  const progression = plan.progression
  const arc = plan.arc
  const motifTemplates = MOTIF_BANKS[plan.motifFamily]
  const coreMotif = motifTemplates[plan.motifIndex]
  const leadOctave = plan.leadOctave
  const spaciousness = result.analysis.dimensions.openness
  const sparseness = clamp(
    result.analysis.dimensions.grief * 0.45
      + result.analysis.dimensions.calm * 0.35
      + result.analysis.dimensions.isolation * 0.5,
    0,
    1,
  )
  const introBars = arc.filter((section) => section === 'intro').length
  const outroIndex = bars - 1

  master.gain.setValueAtTime(0.0001, startAt)
  arc.forEach((section, barIndex) => {
    const targetAt = startAt + barIndex * bar + (barIndex === 0 ? Math.min(0.34, beat * 0.7) : 0.08)
    master.gain.linearRampToValueAtTime(plan.dynamics[section], targetAt)
  })
  master.gain.setValueAtTime(plan.dynamics.outro, startAt + musicalDuration - 0.32)
  master.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  const scheduleLead = (frequency: number, noteStart: number, noteDuration: number, volume: number, pan: number) => {
    if (plan.lead === 'clarinet') {
      scheduleAcousticClarinet(context, buses, sampleBank, frequency, noteStart, noteDuration, volume * 0.82, pan)
    } else if (plan.lead === 'guitar') {
      scheduleAcousticGuitar(context, buses, sampleBank, frequency, noteStart, noteDuration, volume * 0.92, pan)
    } else {
      scheduleAcousticPiano(context, buses, sampleBank, frequency, noteStart, noteDuration, volume, pan)
    }
  }

  let previousChordDegrees: number[] | null = null
  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const barStart = startAt + barIndex * bar
    const section = arc[barIndex]
    const isIntro = section === 'intro'
    const isTurn = section === 'turn'
    const isClimax = section === 'climax'
    const isOutro = section === 'outro'
    const cadence = CADENCE_MOTIFS[plan.cadence]
    const chordRoot = isOutro ? cadence.finalChord : progression[barIndex % progression.length]
    const voicedTriad = voiceLeadChord(chordRoot, previousChordDegrees, scale.length)
    previousChordDegrees = voicedTriad
    const chordDegrees = isIntro
      ? [voicedTriad[0], voicedTriad[2]]
      : isClimax
        ? [...voicedTriad, voicedTriad[0] + scale.length]
        : voicedTriad
    const dynamics = plan.dynamics[section]

    chordDegrees.forEach((degree, noteIndex) => {
      const semitone = degreeSemitone(scale, degree)
      const frequency = noteFrequency(root, semitone, -1)
      const pan = (noteIndex - (chordDegrees.length - 1) / 2) * 0.16
      if (plan.harmony === 'cello') {
        scheduleCelloLayer(
          context,
          buses,
          sampleBank,
          frequency,
          barStart + noteIndex * 0.014,
          isOutro ? bar + RELEASE_TAIL_SECONDS * 0.7 : bar * 0.96,
          (isClimax ? 0.019 : isTurn ? 0.014 : 0.022) * dynamics,
          pan,
          true,
        )
      } else if (plan.harmony === 'piano') {
        const pulseOffsets = plan.mood === 'joyful'
          ? isOutro ? [0] : [0, 1.5, 2.75]
          : plan.mood === 'tense'
            ? isOutro ? [0] : [0, 1.25, 2.62]
            : [0]
        pulseOffsets.forEach((offset, pulseIndex) => {
          scheduleAcousticPiano(
            context,
            buses,
            sampleBank,
            frequency,
            barStart + beat * offset + noteIndex * 0.012,
            beat * (plan.mood === 'tender' ? 1.5 : 0.46),
            (plan.mood === 'joyful' ? 0.018 : 0.014) * dynamics * (pulseIndex === 0 ? 1 : 0.84),
            pan,
          )
        })
      } else if (noteIndex < 3) {
        const offset = isIntro ? 1.8 + noteIndex * 0.42 : noteIndex * (plan.mood === 'calm' ? 0.82 : 0.56)
        scheduleAcousticGuitar(
          context,
          buses,
          sampleBank,
          frequency,
          barStart + beat * offset,
          beat * (plan.mood === 'calm' ? 1.18 : 0.7),
          0.018 * dynamics,
          pan,
        )
      }
    })

    const rootSemitone = degreeSemitone(scale, chordRoot)
    if (!isIntro && plan.bass !== 'none') {
      const scheduleBass = plan.bass === 'cello' ? scheduleAcousticBass : schedulePianoBass
      scheduleBass(
          context,
          buses,
          sampleBank,
          noteFrequency(root, rootSemitone, -2),
          barStart,
          isOutro ? beat * 3.5 : beat * 1.45,
          (isOutro ? 0.07 : 0.092) * dynamics,
        )
      if (!isOutro && !isTurn) {
        const secondBassDegree = isClimax ? chordRoot + 4 : chordRoot
        scheduleBass(
          context,
          buses,
          sampleBank,
          noteFrequency(root, degreeSemitone(scale, secondBassDegree), -2),
          barStart + beat * 2,
          beat * 1.45,
          (isClimax ? 0.085 : 0.072) * dynamics,
        )
      }
    }

    const arpeggioPattern = [0, 1, 2, 1, 0, 1, 2, 1]
    const arpeggioSteps = isOutro
      ? 0
      : isIntro
        ? 2
        : isTurn
          ? Math.max(2, Math.floor(plan.arpeggioSteps / 2))
        : isClimax
          ? Math.min(8, plan.arpeggioSteps + 2)
        : sparseness > 0.62
          ? 2
          : plan.arpeggioSteps
    for (let step = 0; step < arpeggioSteps; step += 1) {
      const chordDegree = chordDegrees[arpeggioPattern[step] % chordDegrees.length]
      const semitone = degreeSemitone(scale, chordDegree)
      const gridStart = isIntro
        ? barStart + beat * (2 + step)
        : barStart + step * (bar / arpeggioSteps)
      const playingOffset = (seededUnit(seed ^ 0x4a17, barIndex * 37 + step) - 0.5) * 0.026
        + (plan.lead === 'guitar' && step % 2 === 1 ? 0.012 : 0)
      const noteStart = Math.max(barStart, gridStart + playingOffset)
      const humanVelocity = 0.92 + seededUnit(seed, barIndex * 31 + step) * 0.14
      if (plan.lead === 'guitar') {
        scheduleAcousticPiano(context, buses, sampleBank, noteFrequency(root, semitone, -1), noteStart, beat * 0.72, 0.016 * dynamics * humanVelocity, (step % 2 ? 0.2 : -0.2) * (1 + spaciousness * 0.7))
      } else {
        scheduleAcousticGuitar(context, buses, sampleBank, noteFrequency(root, semitone, -1), noteStart, beat * 0.62, 0.024 * dynamics * humanVelocity, (step % 2 ? 0.23 : -0.23) * (1 + spaciousness * 0.7))
      }
    }

    const isCadenceBar = barIndex === outroIndex - 1
    const developmentBar = Math.max(0, barIndex - introBars)
    const developedMotif = coreMotif.map((note, noteIndex) => {
      if (plan.developmentStyle === 'answer') {
        return {
          ...note,
          degree: note.degree + (noteIndex % 2 === 0 ? 1 : -1),
          at: note.at + (noteIndex === 0 ? 0.18 : 0),
        }
      }
      if (plan.developmentStyle === 'expansion') {
        return {
          ...note,
          degree: note.degree + Math.floor(noteIndex / 2),
          length: note.length * (noteIndex === coreMotif.length - 1 ? 1.34 : 0.94),
        }
      }
      return {
        ...note,
        degree: note.degree + (noteIndex === coreMotif.length - 1 ? (seed % 2 === 0 ? 1 : -1) : 0),
        at: note.at + (noteIndex === 0 ? 0.28 : 0),
        length: note.length * (noteIndex === coreMotif.length - 1 ? 1.12 : 1),
      }
    })
    const liftedMotif = coreMotif.map((note, noteIndex) => ({
      ...note,
      degree: note.degree + (
        plan.motifFamily === 'descending' || plan.motifFamily === 'spacious'
          ? 0
          : plan.motifFamily === 'restless'
            ? (noteIndex % 2 === 0 ? 1 : -1)
            : noteIndex % 2 === 0 ? 2 : 1
      ),
      length: note.length * (noteIndex === coreMotif.length - 1 ? 1.28 : 0.92),
    }))
    const turnMotif = coreMotif
      .filter((_, noteIndex) => noteIndex % 2 === 0)
      .map((note, noteIndex) => ({ ...note, at: note.at + 0.12, degree: note.degree - (noteIndex === 0 ? 1 : 0), length: note.length * 1.2 }))
    const motif = isOutro
      ? cadence.outro
      : isCadenceBar
        ? cadence.approach
        : isClimax
          ? liftedMotif
          : isTurn
            ? turnMotif
          : developmentBar >= 2 && developmentBar % 4 >= 2
            ? developedMotif
            : coreMotif
    const harmonizedMotif = fitMotifToChord(motif, chordDegrees, scale.length)

    harmonizedMotif.forEach((note, noteIndex) => {
      if (isIntro && note.at < 2) return
      const timing = isOutro ? 0 : (seededUnit(seed, barIndex * 43 + noteIndex) - 0.5) * 0.042
      const noteStart = Math.max(barStart, barStart + note.at * beat + timing)
      const velocity = 0.91 + seededUnit(seed ^ 0x71c3, barIndex * 47 + noteIndex) * 0.17
      const octave = leadOctave + (isClimax && noteIndex === 2 && plan.lead !== 'guitar' && result.analysis.valence >= -0.1 ? 1 : 0)
      const frequency = noteFrequency(root, degreeSemitone(scale, note.degree), octave)
      const pan = noteIndex % 2 ? 0.1 : -0.1
      const leadVolume = (plan.lead === 'piano' ? 0.048 : plan.lead === 'guitar' ? 0.044 : 0.036)
        * dynamics * velocity
      scheduleLead(frequency, noteStart, beat * note.length, leadVolume, pan)

      if (isClimax && (noteIndex === 0 || noteIndex === 2)) {
        const harmonyFrequency = noteFrequency(root, degreeSemitone(scale, note.degree - 2), octave)
        if (plan.lead === 'guitar') {
          scheduleAcousticPiano(context, buses, sampleBank, harmonyFrequency, noteStart + 0.018, beat * note.length * 0.92, 0.014 * dynamics, -pan * 1.7)
        } else {
          scheduleAcousticGuitar(context, buses, sampleBank, harmonyFrequency, noteStart + 0.018, beat * note.length * 0.88, 0.016 * dynamics, -pan * 1.7)
        }
      }
    })

    if (isClimax && !isOutro && result.analysis.dimensions.isolation < 0.62) {
      const counterDegree = chordRoot + (barIndex % 2 === 0 ? 4 : 2)
      const counterFrequency = noteFrequency(root, degreeSemitone(scale, counterDegree), -1)
      const counterStart = barStart + beat * (barIndex % 2 === 0 ? 1.45 : 2.25)
      if (plan.lead === 'piano') {
        scheduleAcousticGuitar(context, buses, sampleBank, counterFrequency, counterStart, beat * 1.25, 0.019, 0.34)
      } else {
        scheduleAcousticPiano(context, buses, sampleBank, counterFrequency, counterStart, beat * 1.4, 0.017, 0.34)
      }
    }

    if (plan.percussion === 'restless' && !isIntro && !isOutro && !isTurn) {
      const drumOffsets = isClimax ? [0, 1.35, 2.48, 3.22] : [0, 1.62, 2.86]
      drumOffsets.forEach((offset, index) => {
        scheduleFrameDrum(context, buses, sampleBank, barStart + beat * offset, index !== 1 ? 0.088 : 0.058, index % 2 === 1)
      })
      scheduleRecordedWoodblock(context, buses, sampleBank, barStart + beat * 0.78, 0.017, -0.18)
      scheduleRecordedWoodblock(context, buses, sampleBank, barStart + beat * 2.18, 0.019, 0.18)
      if (isClimax) scheduleRecordedWoodblock(context, buses, sampleBank, barStart + beat * 3.54, 0.016, -0.08)
    } else if (plan.percussion !== 'none' && !isIntro && !isOutro && !isTurn) {
      const full = plan.percussion === 'full'
      if (full || isClimax) scheduleFrameDrum(context, buses, sampleBank, barStart, full ? 0.104 : 0.058)
      if (isClimax || (full && barIndex % 2 === 0)) scheduleFrameDrum(context, buses, sampleBank, barStart + beat * 2, full ? 0.08 : 0.044, true)
      if (full) {
        scheduleRecordedWoodblock(context, buses, sampleBank, barStart + beat, isClimax ? 0.02 : 0.015, -0.12)
        scheduleRecordedWoodblock(context, buses, sampleBank, barStart + beat * 3, isClimax ? 0.018 : 0.013, 0.12)
      } else {
        scheduleRecordedShaker(context, buses, sampleBank, barStart + beat, 0.012, false, -0.18)
        scheduleRecordedShaker(context, buses, sampleBank, barStart + beat * 3, 0.01, true, 0.18)
      }
      if (full && (isClimax || plan.mood === 'joyful')) {
        const shakerSteps = isClimax ? 8 : 4
        for (let step = 0; step < shakerSteps; step += 1) {
          scheduleRecordedShaker(
            context,
            buses,
            sampleBank,
            barStart + step * bar / shakerSteps,
            step % 2 ? 0.01 : 0.007,
            step % 2 === 1,
            step % 2 ? 0.22 : -0.22,
          )
        }
      }
    } else if (shouldUseRestrainedShaker(result, plan) && isClimax) {
      scheduleRecordedShaker(context, buses, sampleBank, barStart + beat * 1.02, 0.011, false, -0.28)
      scheduleRecordedShaker(context, buses, sampleBank, barStart + beat * 3.02, 0.009, true, 0.28)
    }

    if (scene.transit && !isIntro && !isOutro && barIndex % 2 === 0) {
      scheduleRecordedWoodblock(context, buses, sampleBank, barStart + beat * 0.5, 0.021, -0.2)
      scheduleRecordedWoodblock(context, buses, sampleBank, barStart + beat * 2.5, 0.016, 0.2)
    }

    if (shouldUseNightBreath(result, scene) && !isIntro && !isOutro && barIndex % 3 === 1) {
      const breathDegree = degreeSemitone(scale, chordRoot + 2)
      scheduleAcousticClarinet(context, buses, sampleBank, noteFrequency(root, breathDegree, -1), barStart + beat * 2.15, beat * 1.55, 0.008, 0.3)
    }

    if (scene.home && !isOutro && barIndex % 2 === 0) {
      const memoryDegree = degreeSemitone(scale, chordRoot + 4)
      scheduleAcousticGuitar(context, buses, sampleBank, noteFrequency(root, memoryDegree), barStart + beat * 3.5, beat * 0.42, 0.017, -0.32)
    }

    if (scene.water && !isIntro && !isOutro && barIndex % 3 === 1) {
      scheduleAcousticClarinet(context, buses, sampleBank, noteFrequency(root, degreeSemitone(scale, chordRoot + 4), -1), barStart + beat * 1.5, beat * 1.35, 0.009, -0.4)
    }

    if (spaciousness > 0.34 && !isIntro && !isOutro && barIndex % 2 === 0) {
      const openDegree = degreeSemitone(scale, chordRoot + 4)
      scheduleAcousticGuitar(
        context,
        buses,
        sampleBank,
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
