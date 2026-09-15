import type { MoodId, StoryEmotionAnalysis } from '../types'

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

// Transparent composition priors, not learned weights or copied source music.
// Each value maps directly to an audible parameter in the candidate renderer.
export const COMPOSITION_TASTE_PROFILES: Record<MoodId, MusicTasteVector> = {
  joyful: { density: 0.88, syncopation: 0.7, upwardContour: 0.76, pitchRange: 0.72, sustain: 0.22, harmonicMotion: 0.68, brightness: 0.9, tension: 0.2, closure: 0.96, dynamicContrast: 0.54 },
  melancholy: { density: 0.3, syncopation: 0.2, upwardContour: 0.26, pitchRange: 0.46, sustain: 0.82, harmonicMotion: 0.38, brightness: 0.28, tension: 0.36, closure: 0.52, dynamicContrast: 0.46 },
  hopeful: { density: 0.64, syncopation: 0.44, upwardContour: 0.78, pitchRange: 0.66, sustain: 0.42, harmonicMotion: 0.54, brightness: 0.76, tension: 0.24, closure: 0.92, dynamicContrast: 0.64 },
  tense: { density: 0.7, syncopation: 0.86, upwardContour: 0.48, pitchRange: 0.82, sustain: 0.24, harmonicMotion: 0.74, brightness: 0.6, tension: 0.94, closure: 0.14, dynamicContrast: 0.86 },
  tender: { density: 0.4, syncopation: 0.28, upwardContour: 0.54, pitchRange: 0.42, sustain: 0.68, harmonicMotion: 0.34, brightness: 0.58, tension: 0.12, closure: 0.86, dynamicContrast: 0.34 },
  calm: { density: 0.2, syncopation: 0.12, upwardContour: 0.5, pitchRange: 0.34, sustain: 0.94, harmonicMotion: 0.2, brightness: 0.48, tension: 0.08, closure: 0.9, dynamicContrast: 0.2 },
  nostalgic: { density: 0.48, syncopation: 0.34, upwardContour: 0.4, pitchRange: 0.52, sustain: 0.64, harmonicMotion: 0.48, brightness: 0.5, tension: 0.3, closure: 0.76, dynamicContrast: 0.46 },
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

export function getStoryTasteTarget(mood: MoodId, analysis: StoryEmotionAnalysis): MusicTasteVector {
  const base = COMPOSITION_TASTE_PROFILES[mood]
  const { dimensions, arousal, valence, direction } = analysis
  const energy = arousal - 0.5
  return {
    density: clamp(base.density + energy * 0.24 + dimensions.joy * 0.08 - dimensions.calm * 0.12 - dimensions.isolation * 0.1),
    syncopation: clamp(base.syncopation + energy * 0.16 + dimensions.tension * 0.1 + dimensions.joy * 0.06 - dimensions.calm * 0.1),
    upwardContour: clamp(base.upwardContour + dimensions.hope * 0.12 + dimensions.agency * 0.06 - dimensions.grief * 0.14 + (direction === 'rising' ? 0.1 : direction === 'falling' ? -0.1 : 0)),
    pitchRange: clamp(base.pitchRange + energy * 0.16 + dimensions.openness * 0.08 - dimensions.calm * 0.08),
    sustain: clamp(base.sustain - energy * 0.18 + dimensions.calm * 0.1 + dimensions.grief * 0.08 - dimensions.joy * 0.1 - dimensions.tension * 0.08),
    harmonicMotion: clamp(base.harmonicMotion + energy * 0.14 + dimensions.agency * 0.06 - dimensions.calm * 0.08),
    brightness: clamp(base.brightness + valence * 0.1 + dimensions.openness * 0.06 - dimensions.grief * 0.1),
    tension: clamp(base.tension + dimensions.tension * 0.12 + dimensions.isolation * 0.05 - dimensions.calm * 0.08),
    closure: clamp(base.closure + dimensions.hope * 0.06 - dimensions.tension * 0.12 - dimensions.grief * 0.04),
    dynamicContrast: clamp(base.dynamicContrast + energy * 0.24 + dimensions.tension * 0.08 - dimensions.calm * 0.1),
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
