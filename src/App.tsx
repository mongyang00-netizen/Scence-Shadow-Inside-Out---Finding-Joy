import React, { useState, useRef, useEffect } from 'react';
import { ScreenType, Sentence, SentenceProgress, PracticeSession } from './types';
import {
  loadSentences,
  saveSentences,
  loadCurrentSession,
  updateSessionProgress,
  startNewSession,
  hasExistingProgress
} from './utils/storage';
import { StartScreen } from './components/StartScreen';
import { SentenceListScreen } from './components/SentenceListScreen';
import { PracticeScreen } from './components/PracticeScreen';
import { EditSentencesScreen } from './components/EditSentencesScreen';
import { FinishScreen } from './components/FinishScreen';
import { YouTubePlayerHandle } from './components/YouTubePlayer';
import { AudioDiagnosticsPanel } from './components/AudioDiagnosticsPanel';
import { SpeechTestScreen } from './components/SpeechTestScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('start');
  const [sentences, setSentences] = useState<Sentence[]>(() => loadSentences());
  const [session, setSession] = useState<PracticeSession>(() => loadCurrentSession());
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);
  const [isSpeechTestMode, setIsSpeechTestMode] = useState<boolean>(false);

  // Shared player ref passed down to the active screen
  const playerRef = useRef<YouTubePlayerHandle | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (search.includes('speechTest=1') || search.includes('testSpeech=1')) {
        setIsSpeechTestMode(true);
      }
    }
  }, []);

  const progressMap = session.progress;

  // Progress update handler (updates current session immutably)
  const handleUpdateProgress = (id: number, update: Partial<SentenceProgress>) => {
    const updatedSession = updateSessionProgress(id, update);
    setSession(updatedSession);
  };

  // Sentences update handler
  const handleSaveSentences = (newSentences: Sentence[]) => {
    setSentences(newSentences);
    saveSentences(newSentences);
    if (currentSentenceIndex >= newSentences.length) {
      setCurrentSentenceIndex(Math.max(0, newSentences.length - 1));
    }
  };

  // Start Screen navigation handlers
  const handleContinuePractice = () => {
    setCurrentScreen('list');
  };

  const handleStartNewPractice = () => {
    const newSess = startNewSession();
    setSession(newSess);
    setCurrentSentenceIndex(0);
    setCurrentScreen('list');
  };

  const handleSelectSentence = (index: number) => {
    if (index >= 0 && index < sentences.length) {
      setCurrentSentenceIndex(index);
      setCurrentScreen('practice');
    }
  };

  const handleNextSentence = () => {
    if (currentSentenceIndex < sentences.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
    } else {
      setCurrentScreen('finish');
    }
  };

  const handlePrevSentence = () => {
    if (currentSentenceIndex > 0) {
      setCurrentSentenceIndex(currentSentenceIndex - 1);
    }
  };

  const handleRestartFromBeginning = () => {
    // Current session is preserved; re-practice from sentence 1
    setCurrentSentenceIndex(0);
    setCurrentScreen('practice');
  };

  const activeSentence = sentences[currentSentenceIndex] || sentences[0];
  const activeProgress = activeSentence ? progressMap[activeSentence.id] : undefined;

  const completedSentencesCount = sentences.filter((s) => {
    const p = progressMap[s.id];
    return p && (p.status === 'done' || p.status === 'practiced');
  }).length;

  const totalRecordingsCount = Object.values(progressMap).reduce(
    (acc, curr) => acc + (curr.recordings || 0),
    0
  );

  const sessionHasProgress = hasExistingProgress(session);

  if (isSpeechTestMode) {
    return (
      <SpeechTestScreen
        onBack={() => setIsSpeechTestMode(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-['Plus_Jakarta_Sans','Noto_Sans_KR',sans-serif]">
      {currentScreen === 'start' && (
        <StartScreen
          onContinue={handleContinuePractice}
          onStartNew={handleStartNewPractice}
          hasExistingProgress={sessionHasProgress}
          completedCount={completedSentencesCount}
          totalRecordingsCount={totalRecordingsCount}
          sessionNumber={session.sessionNumber}
          onEdit={() => setCurrentScreen('edit')}
          sentenceCount={sentences.length}
        />
      )}

      {currentScreen === 'list' && (
        <SentenceListScreen
          sentences={sentences}
          progress={progressMap}
          onSelectSentence={handleSelectSentence}
          onBackToStart={() => setCurrentScreen('start')}
          onGoToEdit={() => setCurrentScreen('edit')}
          playerRef={playerRef}
        />
      )}

      {currentScreen === 'practice' && activeSentence && (
        <PracticeScreen
          sentence={activeSentence}
          currentIndex={currentSentenceIndex}
          totalSentences={sentences.length}
          progress={
            activeProgress || {
              id: activeSentence.id,
              plays: 0,
              recordings: 0,
              selfCheck: [null, null, null],
              status: 'new'
            }
          }
          onUpdateProgress={handleUpdateProgress}
          onPrev={handlePrevSentence}
          onNext={handleNextSentence}
          onBackToList={() => setCurrentScreen('list')}
          onFinish={() => setCurrentScreen('finish')}
          playerRef={playerRef}
        />
      )}

      {currentScreen === 'edit' && (
        <EditSentencesScreen
          sentences={sentences}
          onSaveSentences={handleSaveSentences}
          onBack={() => setCurrentScreen('list')}
          playerRef={playerRef}
        />
      )}

      {currentScreen === 'finish' && (
        <FinishScreen
          sentences={sentences}
          progress={progressMap}
          sessionNumber={session.sessionNumber}
          onPracticeSentence={(index) => {
            setCurrentSentenceIndex(index);
            setCurrentScreen('practice');
          }}
          onRestartAll={handleRestartFromBeginning}
          onGoToList={() => setCurrentScreen('list')}
        />
      )}

      {/* Real-time iOS Audio Diagnostic Overlay (renders ONLY when URL contains ?debugAudio=1) */}
      <AudioDiagnosticsPanel onOpenSpeechTest={() => setIsSpeechTestMode(true)} />
    </div>
  );
}
