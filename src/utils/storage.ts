import { INITIAL_SENTENCES } from '../constants';
import { Sentence, SentenceProgress, PracticeSession } from '../types';

const SENTENCES_STORAGE_KEY = 'scene_shadow_sentences_v7';
const CURRENT_SESSION_KEY = 'scene_shadow_active_session_v1';
const LEGACY_PROGRESS_KEY = 'scene_shadow_progress_v1';

// In-memory fallback if localStorage fails or is restricted in iframe/private mode
let memorySentences: Sentence[] = [...INITIAL_SENTENCES];
let memorySession: PracticeSession = createDefaultSession(1);

export function createDefaultSession(sessionNumber: number = 1): PracticeSession {
  const now = new Date().toISOString();
  return {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sessionNumber,
    startedAt: now,
    lastActiveAt: now,
    progress: {}
  };
}

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
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
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

/**
 * Loads the current active practice session.
 * Safely migrates legacy scene_shadow_progress_v1 if present on first run,
 * then purges the legacy key so past data cannot resurrect in future new sessions.
 */
export function loadCurrentSession(): PracticeSession {
  try {
    const rawSession = localStorage.getItem(CURRENT_SESSION_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed && typeof parsed === 'object' && parsed.sessionId && parsed.progress) {
        memorySession = parsed;
        // Purge legacy key if it is still lingering
        if (localStorage.getItem(LEGACY_PROGRESS_KEY)) {
          localStorage.removeItem(LEGACY_PROGRESS_KEY);
        }
        return parsed;
      }
    }

    // Migration path from legacy scene_shadow_progress_v1
    const rawLegacy = localStorage.getItem(LEGACY_PROGRESS_KEY);
    if (rawLegacy) {
      const parsedLegacy = JSON.parse(rawLegacy);
      if (parsedLegacy && typeof parsedLegacy === 'object') {
        const migratedSession: PracticeSession = {
          sessionId: `session_migrated_${Date.now()}`,
          sessionNumber: 1,
          startedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          progress: parsedLegacy
        };
        saveCurrentSession(migratedSession);
        // CRITICAL: Remove legacy key immediately so it never resurrects
        localStorage.removeItem(LEGACY_PROGRESS_KEY);
        return migratedSession;
      }
    }
  } catch (err) {
    console.warn('Could not read session from localStorage, using memory session:', err);
  }

  return memorySession;
}

export function saveCurrentSession(session: PracticeSession): void {
  memorySession = session;
  try {
    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('Could not save session to localStorage:', err);
  }
}

export function updateSessionProgress(id: number, update: Partial<SentenceProgress>): PracticeSession {
  const session = loadCurrentSession();
  const current: SentenceProgress = session.progress[id] || {
    id,
    plays: 0,
    recordings: 0,
    selfCheck: [null, null, null],
    status: 'new'
  };

  const updatedProgress: SentenceProgress = {
    ...current,
    ...update,
    id
  };

  const updatedSession: PracticeSession = {
    ...session,
    lastActiveAt: new Date().toISOString(),
    progress: {
      ...session.progress,
      [id]: updatedProgress
    }
  };

  saveCurrentSession(updatedSession);
  return updatedSession;
}

/**
 * Resets learning progress and starts a fresh new PracticeSession.
 * Sentences and edits in SENTENCES_STORAGE_KEY remain 100% intact.
 */
export function startNewSession(): PracticeSession {
  const current = loadCurrentSession();
  const nextNum = (current.sessionNumber || 1) + 1;
  const newSession = createDefaultSession(nextNum);

  // Guarantee legacy key is deleted
  try {
    localStorage.removeItem(LEGACY_PROGRESS_KEY);
  } catch (e) {}

  saveCurrentSession(newSession);
  return newSession;
}

/**
 * Helper to check whether the session has any recorded activity.
 */
export function hasExistingProgress(session: PracticeSession): boolean {
  if (!session || !session.progress) return false;
  return Object.values(session.progress).some(
    (p) =>
      (p.recordings || 0) > 0 ||
      (p.plays || 0) > 0 ||
      p.status === 'done' ||
      p.status === 'practiced' ||
      (p.selfCheck && p.selfCheck.some((r) => r !== null)) ||
      (p.practiceWords && p.practiceWords.length > 0)
  );
}

// Backward compatibility helpers
export function loadAllProgress(): Record<number, SentenceProgress> {
  return loadCurrentSession().progress;
}

export function saveProgress(id: number, update: Partial<SentenceProgress>): SentenceProgress {
  const updatedSession = updateSessionProgress(id, update);
  return updatedSession.progress[id];
}

export function resetProgress(): void {
  startNewSession();
}
