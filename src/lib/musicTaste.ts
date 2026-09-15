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

export function getStoryTasteTarget(mood: MoodId, analysis: StoryEmotionAnalysis): MusicTasteVector {
  const base = COMPOSITION_TASTE_PROFILES[mood]
  const { dimensions, arousal, valence, direction } = analysis
  const energy = arousal - 0.5
  return {
    density: clamp(base.density + energy * 0.24 + dimensions.joy * 0.08 + dimensions.nostalgia * 0.08 - dimensions.calm * 0.12 - dimensions.isolation * 0.1),
    syncopation: clamp(base.syncopation + energy * 0.16 + dimensions.tension * 0.1 + dimensions.joy * 0.06 + dimensions.nostalgia * 0.04 - dimensions.calm * 0.1),
    upwardContour: clamp(base.upwardContour + dimensions.hope * 0.12 + dimensions.agency * 0.06 - dimensions.grief * 0.14 - dimensions.nostalgia * 0.12 + (direction === 'rising' ? 0.1 : direction === 'falling' ? -0.1 : 0)),
    pitchRange: clamp(base.pitchRange + energy * 0.16 + dimensions.openness * 0.08 + dimensions.nostalgia * 0.04 - dimensions.calm * 0.08),
    sustain: clamp(base.sustain - energy * 0.18 + dimensions.calm * 0.1 + dimensions.grief * 0.08 + dimensions.nostalgia * 0.07 - dimensions.joy * 0.1 - dimensions.tension * 0.08),
    harmonicMotion: clamp(base.harmonicMotion + energy * 0.14 + dimensions.agency * 0.06 + dimensions.nostalgia * 0.06 - dimensions.calm * 0.08),
    brightness: clamp(base.brightness + valence * 0.1 + dimensions.openness * 0.06 - dimensions.grief * 0.1 - dimensions.nostalgia * 0.02),
    tension: clamp(base.tension + dimensions.tension * 0.12 + dimensions.isolation * 0.05 + dimensions.nostalgia * 0.03 - dimensions.calm * 0.08),
    closure: clamp(base.closure + dimensions.hope * 0.06 - dimensions.tension * 0.12 - dimensions.grief * 0.04 - dimensions.nostalgia * 0.04),
    dynamicContrast: clamp(base.dynamicContrast + energy * 0.24 + dimensions.tension * 0.08 + dimensions.nostalgia * 0.04 - dimensions.calm * 0.1),
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
