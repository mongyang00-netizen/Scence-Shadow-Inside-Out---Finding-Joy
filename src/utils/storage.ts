import { INITIAL_SENTENCES } from '../constants';
import { Sentence, SentenceProgress } from '../types';

const SENTENCES_STORAGE_KEY = 'scene_shadow_sentences_v7';
const PROGRESS_STORAGE_KEY = 'scene_shadow_progress_v1';

// In-memory fallback if localStorage fails or is restricted in iframe/private mode
let memorySentences: Sentence[] = [...INITIAL_SENTENCES];
let memoryProgress: Record<number, SentenceProgress> = {};

export function loadSentences(): Sentence[] {
  try {
    // Clear old legacy keys if present so stale sentences are not loaded
    ['scene_shadow_sentences_v1', 'scene_shadow_sentences_v2', 'scene_shadow_sentences_v3', 'scene_shadow_sentences_v4', 'scene_shadow_sentences_v5', 'scene_shadow_sentences_v6'].forEach(
      (key) => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
        }
      }
    );

    const raw = localStorage.getItem(SENTENCES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memorySentences = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read sentences from localStorage, using fallback:', err);
  }
  // Initialize with the new sentences
  memorySentences = [...INITIAL_SENTENCES];
  saveSentences(INITIAL_SENTENCES);
  return memorySentences;
}

export function saveSentences(sentences: Sentence[]): void {
  memorySentences = sentences;
  try {
    localStorage.setItem(SENTENCES_STORAGE_KEY, JSON.stringify(sentences));
  } catch (err) {
    console.warn('Could not save sentences to localStorage:', err);
  }
}

export function loadAllProgress(): Record<number, SentenceProgress> {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        memoryProgress = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read progress from localStorage, using fallback:', err);
  }
  return memoryProgress;
}

export function saveProgress(id: number, update: Partial<SentenceProgress>): SentenceProgress {
  const all = loadAllProgress();
  const current: SentenceProgress = all[id] || {
    id,
    plays: 0,
    recordings: 0,
    selfCheck: [null, null, null],
    status: 'new'
  };

  const updated: SentenceProgress = {
    ...current,
    ...update,
    id
  };

  all[id] = updated;
  memoryProgress = all;

  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn('Could not save progress to localStorage:', err);
  }

  return updated;
}

export function resetProgress(): void {
  memoryProgress = {};
  try {
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
  } catch (err) {
    console.warn('Could not reset progress in localStorage:', err);
  }
}
