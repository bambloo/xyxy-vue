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
  color: string
  createdAt: string
}

export type GalaxyStarVote = 'like' | 'dislike'
export type GalaxyStarListView = 'normal' | 'blackhole'

export interface GalaxyStarListResponse {
  stars: GalaxyStarView[]
  connections: GalaxyStarConnection[]
  hiddenStarIds: string[]
  blackHoleEntries: GalaxyBlackHoleEntry[]
  totalCount: number
}

export interface GalaxyBlackHoleEntry {
  id: string
  starId: string
  contentId: string
  kind: 'star' | 'comment'
  content: string
  likeCount: number
  dislikeCount: number
  myVote?: GalaxyStarVote
}

export interface GalaxyStarComment {
  id: string
  sourceStarId?: string
  sourceStarTitle?: string
  content: string
  createdAt: string
  parentCommentId?: string
  likeCount?: number
  dislikeCount?: number
  myVote?: GalaxyStarVote
  isOwn?: boolean
}

export interface GalaxyStarConnection {
  sourceStarId: string
  targetStarId: string
  count: number
}

export interface GalaxyStarView extends SentGalaxyStar {
  likeCount: number
  dislikeCount: number
  connectionCount: number
  comments: GalaxyStarComment[]
  isOwn: boolean
  myVote?: GalaxyStarVote
}
