import React, { useEffect } from 'react';
import { Sentence, SentenceProgress } from '../types';
import { OneLineCredit } from './EducationalNoticeCard';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Sparkles,
  RotateCcw,
  List,
  ArrowRight,
  Mic,
  Award,
  AlertCircle,
  Play
} from 'lucide-react';

interface FinishScreenProps {
  sentences: Sentence[];
  progress: Record<number, SentenceProgress>;
  onPracticeSentence: (index: number) => void;
  onRestartAll: () => void;
  onGoToList: () => void;
}

export const FinishScreen: React.FC<FinishScreenProps> = ({
  sentences,
  progress,
  onPracticeSentence,
  onRestartAll,
  onGoToList
}) => {
  // Fire celebration confetti once upon mounting
  useEffect(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // ignore
    }
  }, []);

  // Compute stats
  const totalSentences = sentences.length;
  const completedSentences = sentences.filter((s) => {
    const p = progress[s.id];
    return p && (p.status === 'done' || p.status === 'practiced');
  }).length;

  const totalRecordings = Object.values(progress).reduce(
    (acc, curr) => acc + (curr.recordings || 0),
    0
  );

  // Sentences with 😐 in any of the 3 self-check questions
  const needsPracticeSentences: { sentence: Sentence; index: number }[] = [];
  sentences.forEach((s, idx) => {
    const p = progress[s.id];
    if (p && p.selfCheck && p.selfCheck.includes('neutral')) {
      needsPracticeSentences.push({ sentence: s, index: idx });
    }
  });

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 max-w-lg mx-auto px-4 py-8 justify-between">
      <div className="space-y-6">
        {/* Celebration Header */}
        <div className="text-center space-y-3 pt-4">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-400/30">
            <Trophy className="w-9 h-9" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
              Shadowing Complete
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Great Job! / 훌륭해요!
            </h1>
            <p className="text-sm text-slate-600">
              You practiced native speech rhythms from Inside Out.
              <span className="block text-xs text-slate-400 mt-0.5">
                원어민의 감정과 억양을 따라 멋지게 연습을 마쳤습니다.
              </span>
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs text-center space-y-1">
            <Award className="w-5 h-5 mx-auto text-amber-500" />
            <span className="text-2xl font-black text-slate-900 tabular-nums">
              {completedSentences} / {totalSentences}
            </span>
            <p className="text-[11px] font-semibold text-slate-500">
              Sentences Practiced<br />연습 완료 문장
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs text-center space-y-1">
            <Mic className="w-5 h-5 mx-auto text-rose-500" />
            <span className="text-2xl font-black text-slate-900 tabular-nums">
              {totalRecordings}
            </span>
            <p className="text-[11px] font-semibold text-slate-500">
              Total Voice Takes<br />총 녹음 횟수
            </p>
          </div>
        </div>

        {/* Sentences marked with 😐 (Self-Check Needs Improvement) */}
        {needsPracticeSentences.length > 0 ? (
          <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-2">
              <span className="text-lg">😐</span>
              <span>Needs More Practice / 아쉬웠던 문장 ({needsPracticeSentences.length})</span>
            </div>
            <p className="text-xs text-slate-500">
              자가 진단에서 😐를 선택한 문장들입니다. 한 번 더 연습해보세요!
            </p>

            <div className="space-y-2">
              {needsPracticeSentences.map(({ sentence, index }) => (
                <div
                  key={sentence.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between gap-3"
                >
                  <div className="text-xs space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="font-bold text-slate-800">{sentence.speaker}</span>
                    </div>
                    <p className="font-medium text-slate-900 [word-break:keep-all] break-words">{sentence.text}</p>
                    <p className="text-[11px] text-slate-400 [word-break:keep-all] break-words">{sentence.korean}</p>
                  </div>

                  <button
                    onClick={() => onPracticeSentence(index)}
                    className="min-h-[40px] px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 shrink-0 transition-colors cursor-pointer shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Practice again / 다시 연습</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs text-center space-y-2">
            <span className="text-2xl">🎉</span>
            <p className="text-sm font-bold text-emerald-900">
              All self-checks look great!
            </p>
            <p className="text-xs text-emerald-700">
              모든 문장을 자신감 있게 소화했습니다! 꾸준히 연습하여 자연스러운 말하기를 유지하세요.
            </p>
          </div>
        )}

        {/* Navigation CTAs */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={onRestartAll}
            className="w-full min-h-[50px] py-3 px-5 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Practice from Sentence 1 / 처음부터 다시 연습하기</span>
          </button>

          <button
            onClick={onGoToList}
            className="w-full min-h-[48px] py-2.5 px-5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <List className="w-4 h-4 text-slate-500" />
            <span>Go to Sentence List / 문장 목록으로 돌아가기</span>
          </button>
        </div>
      </div>

      {/* Mandatory Finish Screen Credit */}
      <div className="pt-8 pb-4">
        <OneLineCredit />
      </div>
    </div>
  );
};
