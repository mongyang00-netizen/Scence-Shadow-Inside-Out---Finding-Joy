import React, { useState, useRef } from 'react';
import { ScreenType, Sentence, SentenceProgress } from './types';
import { loadSentences, saveSentences, loadAllProgress, saveProgress, resetProgress } from './utils/storage';
import { StartScreen } from './components/StartScreen';
import { SentenceListScreen } from './components/SentenceListScreen';
import { PracticeScreen } from './components/PracticeScreen';
import { EditSentencesScreen } from './components/EditSentencesScreen';
import { FinishScreen } from './components/FinishScreen';
import { YouTubePlayerHandle } from './components/YouTubePlayer';
import { AudioDiagnosticsPanel } from './components/AudioDiagnosticsPanel';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('start');
  const [sentences, setSentences] = useState<Sentence[]>(() => loadSentences());
  const [progressMap, setProgressMap] = useState<Record<number, SentenceProgress>>(() => loadAllProgress());
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);

  // Shared player ref passed down to the active screen
  const playerRef = useRef<YouTubePlayerHandle | null>(null);

  // Progress update handler
  const handleUpdateProgress = (id: number, update: Partial<SentenceProgress>) => {
    const updated = saveProgress(id, update);
    setProgressMap((prev) => ({
      ...prev,
      [id]: updated
    }));
  };

  // Sentences update handler
  const handleSaveSentences = (newSentences: Sentence[]) => {
    setSentences(newSentences);
    saveSentences(newSentences);
    if (currentSentenceIndex >= newSentences.length) {
      setCurrentSentenceIndex(Math.max(0, newSentences.length - 1));
    }
  };

  // Navigation handlers
  const handleStartFromHome = () => {
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
    setCurrentSentenceIndex(0);
    setCurrentScreen('practice');
  };

  const activeSentence = sentences[currentSentenceIndex] || sentences[0];
  const activeProgress = activeSentence ? progressMap[activeSentence.id] : undefined;

  return (
    <div className="min-h-screen bg-slate-100 font-['Plus_Jakarta_Sans','Noto_Sans_KR',sans-serif]">
      {currentScreen === 'start' && (
        <StartScreen
          onStart={handleStartFromHome}
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
          onPracticeSentence={(index) => {
            setCurrentSentenceIndex(index);
            setCurrentScreen('practice');
          }}
          onRestartAll={handleRestartFromBeginning}
          onGoToList={() => setCurrentScreen('list')}
        />
      )}

      {/* Real-time iOS Audio Diagnostic Overlay (renders ONLY when URL contains ?debugAudio=1) */}
      <AudioDiagnosticsPanel />
    </div>
  );
}
