import type { MoodId, StoryEmotionAnalysis } from '../types'
import { REFERENCE_TASTE_PROFILES } from './generated/referenceProfiles'

export type DevelopmentStyle = 'echo' | 'answer' | 'expansion'
export type TextureStyle = 'intimate' | 'flowing' | 'driving'

export interface MusicTasteVector {
  density: number
  syncopation: number
  upwardContour: number
  pitchRange: number
  sustain: number
  harmonicMotion: number
  brightness: number
  tension: number
  closure: number
  dynamicContrast: number
}

// Reproducibly generated from authored priors blended with normalized CC0 score
// observations. No source notes or lyrics are present in this runtime module.
export const COMPOSITION_TASTE_PROFILES = Object.fromEntries(
  Object.entries(REFERENCE_TASTE_PROFILES).map(([mood, profile]) => [mood, profile.target]),
) as Record<MoodId, MusicTasteVector>

export const AUTHORED_COMPOSITION_PRIORS = Object.fromEntries(
  Object.entries(REFERENCE_TASTE_PROFILES).map(([mood, profile]) => [mood, profile.authoredTarget]),
) as Record<MoodId, MusicTasteVector>

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

export function getNarrativeMusicSignals(analysis: StoryEmotionAnalysis) {
  const { dimensions, arousal, direction } = analysis
  const positiveStrength = Math.max(dimensions.joy, dimensions.hope, dimensions.tenderness * 0.72)
  const negativeStrength = Math.max(dimensions.grief, dimensions.tension * 0.82, dimensions.isolation * 0.76)
  const emotionalContrast = Math.min(positiveStrength, negativeStrength)
  const release = direction === 'rising'
    ? clamp(dimensions.hope * 0.45 + dimensions.agency * 0.35 + Math.max(dimensions.grief, dimensions.tension) * 0.2)
    : 0
  const fallingWeight = direction === 'falling'
    ? clamp(dimensions.grief * 0.48 + dimensions.isolation * 0.34 + dimensions.tension * 0.18)
    : 0
  const entrapment = fallingWeight * (1 - dimensions.agency * 0.35)
  const quietConfession = clamp(
    Math.max(dimensions.grief, dimensions.nostalgia, dimensions.tenderness)
      * (1 - arousal)
      * (0.7 + dimensions.isolation * 0.3),
  )
  const restraint = clamp(
    (dimensions.calm * 0.55 + dimensions.tenderness * 0.25 + dimensions.isolation * 0.2) * (1 - arousal * 0.45),
  )
  return {
    emotionalContrast,
    release,
    fallingWeight,
    entrapment,
    quietConfession,
    restraint,
    bittersweetPulse: emotionalContrast * arousal,
  }
}

export function getStoryTasteTarget(mood: MoodId, analysis: StoryEmotionAnalysis): MusicTasteVector {
  const base = COMPOSITION_TASTE_PROFILES[mood]
  const { dimensions, arousal, valence, direction } = analysis
  const energy = arousal - 0.5
  const { emotionalContrast, release, entrapment, quietConfession, bittersweetPulse } = getNarrativeMusicSignals(analysis)
  return {
    density: clamp(base.density + energy * 0.24 + dimensions.joy * 0.08 + dimensions.nostalgia * 0.08 + release * 0.06 + bittersweetPulse * 0.04 - dimensions.calm * 0.12 - dimensions.isolation * 0.1 - entrapment * 0.05 - quietConfession * 0.04),
    syncopation: clamp(base.syncopation + energy * 0.16 + dimensions.tension * 0.1 + dimensions.joy * 0.06 + dimensions.nostalgia * 0.04 + bittersweetPulse * 0.07 - dimensions.calm * 0.1 - quietConfession * 0.05),
    upwardContour: clamp(base.upwardContour + dimensions.hope * 0.12 + dimensions.agency * 0.06 + release * 0.08 - dimensions.grief * 0.14 - dimensions.nostalgia * 0.12 - entrapment * 0.08 + (direction === 'rising' ? 0.1 : direction === 'falling' ? -0.1 : 0)),
    pitchRange: clamp(base.pitchRange + energy * 0.16 + dimensions.openness * 0.08 + dimensions.nostalgia * 0.04 + release * 0.05 - dimensions.calm * 0.08 - quietConfession * 0.05),
    sustain: clamp(base.sustain - energy * 0.18 + dimensions.calm * 0.1 + dimensions.grief * 0.08 + dimensions.nostalgia * 0.07 + quietConfession * 0.08 + emotionalContrast * 0.03 - dimensions.joy * 0.1 - dimensions.tension * 0.08 - release * 0.03),
    harmonicMotion: clamp(base.harmonicMotion + energy * 0.14 + dimensions.agency * 0.06 + dimensions.nostalgia * 0.06 + release * 0.07 - dimensions.calm * 0.08 - entrapment * 0.06),
    brightness: clamp(base.brightness + valence * 0.1 + dimensions.openness * 0.06 + emotionalContrast * 0.02 - dimensions.grief * 0.1 - dimensions.nostalgia * 0.02),
    tension: clamp(base.tension + dimensions.tension * 0.12 + dimensions.isolation * 0.05 + dimensions.nostalgia * 0.03 + emotionalContrast * 0.08 + entrapment * 0.05 - dimensions.calm * 0.08),
    closure: clamp(base.closure + dimensions.hope * 0.06 + release * 0.1 - dimensions.tension * 0.12 - dimensions.grief * 0.04 - dimensions.nostalgia * 0.04 - emotionalContrast * 0.04 - entrapment * 0.1),
    dynamicContrast: clamp(base.dynamicContrast + energy * 0.24 + dimensions.tension * 0.08 + dimensions.nostalgia * 0.04 + release * 0.12 + emotionalContrast * 0.05 - dimensions.calm * 0.1 - quietConfession * 0.04),
  }
}

const FEATURE_WEIGHTS: Record<keyof MusicTasteVector, number> = {
  density: 1.25,
  syncopation: 0.85,
  upwardContour: 1.15,
  pitchRange: 0.78,
  sustain: 1.05,
  harmonicMotion: 0.82,
  brightness: 1.2,
  tension: 1.1,
  closure: 1.08,
  dynamicContrast: 0.7,
}

export function scoreTasteFit(candidate: MusicTasteVector, target: MusicTasteVector) {
  const weightedError = (Object.keys(FEATURE_WEIGHTS) as Array<keyof MusicTasteVector>)
    .reduce((total, key) => total + Math.abs(candidate[key] - target[key]) * FEATURE_WEIGHTS[key], 0)
  const totalWeight = Object.values(FEATURE_WEIGHTS).reduce((total, weight) => total + weight, 0)
  return clamp(1 - weightedError / totalWeight)
}

export function tasteVectorDistance(left: MusicTasteVector, right: MusicTasteVector) {
  const weightedError = (Object.keys(FEATURE_WEIGHTS) as Array<keyof MusicTasteVector>)
    .reduce((total, key) => total + Math.abs(left[key] - right[key]) * FEATURE_WEIGHTS[key], 0)
  const totalWeight = Object.values(FEATURE_WEIGHTS).reduce((total, weight) => total + weight, 0)
  return weightedError / totalWeight
}
