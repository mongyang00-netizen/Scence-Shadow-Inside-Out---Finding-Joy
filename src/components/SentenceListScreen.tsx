import React, { useState } from 'react';
import { Sentence, SentenceProgress } from '../types';
import { YouTubePlayer, YouTubePlayerHandle } from './YouTubePlayer';
import { Play, Pause, Eye, EyeOff, ChevronRight, Settings2, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { MOVIE_SETTINGS } from '../constants';

interface SentenceListScreenProps {
  sentences: Sentence[];
  progress: Record<number, SentenceProgress>;
  onSelectSentence: (index: number) => void;
  onBackToStart: () => void;
  onGoToEdit: () => void;
  playerRef: React.RefObject<YouTubePlayerHandle | null>;
}

export const SentenceListScreen: React.FC<SentenceListScreenProps> = ({
  sentences,
  progress,
  onSelectSentence,
  onBackToStart,
  onGoToEdit,
  playerRef
}) => {
  const [hideAllText, setHideAllText] = useState(false);
  const [playingSentenceId, setPlayingSentenceId] = useState<number | null>(null);
  const [isPlayingFullClip, setIsPlayingFullClip] = useState(false);

  const handleTogglePlayFullClip = () => {
    if (!playerRef.current) return;
    if (isPlayingFullClip) {
      playerRef.current.pause();
      setIsPlayingFullClip(false);
    } else {
      setPlayingSentenceId(null);
      setIsPlayingFullClip(true);
      playerRef.current.playFullClip(() => {
        setIsPlayingFullClip(false);
      });
    }
  };

  const getProgressBadge = (p?: SentenceProgress) => {
    if (!p || p.status === 'new') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
          <span className="text-base leading-none">☆</span>
          <span>Not started / 미시작</span>
        </span>
      );
    }
    if (p.status === 'done') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500">
          <span className="text-base leading-none">★</span>
          <span>Done / 마스터</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600">
        <span className="text-base leading-none">◐</span>
        <span>Practiced / 연습함</span>
      </span>
    );
  };

  const handlePreviewSentence = (e: React.MouseEvent, s: Sentence) => {
    e.stopPropagation();
    if (playerRef.current) {
      setPlayingSentenceId(s.id);
      playerRef.current.playSegment(s.start, s.end, () => {
        setPlayingSentenceId(null);
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 max-w-lg mx-auto pb-12">
      {/* Top App Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <button
          onClick={onBackToStart}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          title="Back to start"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h2 className="text-base font-bold text-slate-900">Practice Sentences</h2>
          <p className="text-[11px] text-slate-500 font-medium">문장 목록 ({sentences.length}개)</p>
        </div>

        <button
          onClick={onGoToEdit}
          className="p-2 -mr-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          title="Edit sentences"
        >
          <Settings2 className="w-5 h-5" />
        </button>
      </div>

      {/* Video Player (16:9 full width) + One-line credit */}
      <YouTubePlayer
        ref={playerRef}
        onEndedSegment={() => {
          setIsPlayingFullClip(false);
          setPlayingSentenceId(null);
        }}
      />

      {/* Controls Bar for the list */}
      <div className="px-4 py-2.5 flex items-center justify-between bg-white border-b border-slate-200 gap-2">
        <button
          onClick={handleTogglePlayFullClip}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
            isPlayingFullClip
              ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
              : 'bg-slate-900 text-white hover:bg-slate-800 border-slate-900 shadow-xs'
          }`}
          title="영상 보기"
        >
          {isPlayingFullClip ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>일시정지</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>영상 보기</span>
            </>
          )}
        </button>

        <button
          onClick={() => setHideAllText(!hideAllText)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
        >
          {hideAllText ? (
            <>
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>Show Text / 자막 보기</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5 text-slate-500" />
              <span>Hide Text / 자막 숨기기</span>
            </>
          )}
        </button>
      </div>

      {/* Empty State */}
      {sentences.length === 0 ? (
        <div className="p-8 text-center bg-white m-4 rounded-2xl border border-slate-200 space-y-3">
          <p className="text-base font-medium text-slate-600">
            No sentences yet. Tap Edit Sentences to add some.
          </p>
          <p className="text-xs text-slate-400">등록된 문장이 없습니다. 문장 편집을 눌러 추가해주세요.</p>
          <button
            onClick={onGoToEdit}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-sm"
          >
            Edit Sentences / 문장 편집
          </button>
        </div>
      ) : (
        /* Sentences List */
        <div className="p-4 space-y-3">
          {sentences.map((s, index) => {
            const prog = progress[s.id];
            const isJoy = s.speaker.toLowerCase().includes('joy');
            const isPlayingThis = playingSentenceId === s.id;

            return (
              <div
                key={s.id}
                onClick={() => onSelectSentence(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelectSentence(index);
                }}
                className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-[0.99] text-left relative overflow-hidden ${
                  isPlayingThis ? 'border-sky-400 ring-2 ring-sky-200' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header: Index, Speaker, Status, Preview */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
                      #{index + 1}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isJoy
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-sky-100 text-sky-900 border border-sky-200'
                      }`}
                    >
                      {s.speaker}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {s.start}s - {s.end}s
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {getProgressBadge(prog)}
                    <button
                      onClick={(e) => handlePreviewSentence(e, s)}
                      className={`p-1.5 rounded-full transition-colors ${
                        isPlayingThis
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      title="Play segment"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>

                {/* Sentence English Text with Bold Stresses */}
                <div className="my-1.5">
                  {hideAllText ? (
                    <div className="h-6 flex items-center gap-1.5 text-slate-400 text-xs italic bg-slate-50 px-2 py-1 rounded-lg">
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Text hidden · 텍스트 숨김 (듣기 연습에 집중해보세요)</span>
                    </div>
                  ) : (
                    <p className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed [word-break:keep-all] break-words">
                      {s.text.split(' ').map((word, wIdx) => {
                        const cleanWord = word.toLowerCase().replace(/[^a-z']/g, '');
                        const isStressed = s.stress.some(
                          (st) => st.toLowerCase().replace(/[^a-z']/g, '') === cleanWord
                        );
                        return (
                          <span
                            key={wIdx}
                            className={
                              isStressed
                                ? 'font-extrabold text-slate-950 underline decoration-amber-400 decoration-2 underline-offset-[5px] [text-decoration-skip-ink:none] bg-amber-100/60 px-0.5 rounded-xs inline-block my-0.5'
                                : 'font-normal text-slate-800'
                            }
                          >
                            {word}{' '}
                          </span>
                        );
                      })}
                    </p>
                  )}
                </div>

                {/* Korean Meaning */}
                {!hideAllText && (
                  <p className="text-xs text-slate-500 mt-1 [word-break:keep-all] break-words">{s.korean}</p>
                )}

                {/* Recording indicator & arrow */}
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Recordings / 녹음: <strong className="text-slate-800">{prog?.recordings || 0}</strong>회
                  </span>
                  <div className="flex items-center text-sky-600 font-semibold gap-0.5">
                    <span>Practice / 연습하기</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Start Button bottom bar */}
      {sentences.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => onSelectSentence(0)}
              className="w-full min-h-[48px] py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start from Sentence 1 / 1번부터 연습하기</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
