export interface Sentence {
  id: number;
  speaker: string;
  text: string;
  korean: string;
  stress: string[];
  start: number;
  end: number;
}

export type Rating = 'happy' | 'smile' | 'neutral' | null;

export interface SentenceProgress {
  id: number;
  plays: number;
  recordings: number;
  selfCheck: [Rating, Rating, Rating];
  status: 'new' | 'practiced' | 'done';
}

export type ScreenType = 'start' | 'list' | 'practice' | 'edit' | 'finish';

export interface MovieSettings {
  titleEn: string;
  titleKo: string;
  releaseYear: number;
  director: string;
  screenplay: string;
  production: string;
  distribution: string;
  sceneDescription: string;
  youtubeTitle: string;
  youtubeChannel: string;
  youtubeUrl: string;
  videoId: string;
  practiceStart: number;
  practiceEnd: number;
  madeBy: string;
}
