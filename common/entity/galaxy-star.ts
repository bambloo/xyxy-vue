export const GALAXY_STAR_COLORS = [
  '#7ec8ff',
  '#a7e8ff',
  '#ffd27d',
  '#ff9fba',
  '#b69cff',
  '#8ff0da',
  '#ff8a65',
  '#f4f06e',
  '#f7a8ff',
  '#ffffff',
] as const

export interface SentGalaxyStar {
  id: string
  title: string
  content: string
  color: (typeof GALAXY_STAR_COLORS)[number]
  createdAt: string
}
