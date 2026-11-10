import React, { useState } from 'react';
import { EducationalNoticeCard } from './EducationalNoticeCard';
import { Play, Sparkles, BookOpen, Settings2, Headphones, Mic, Volume2, RotateCcw, AlertTriangle, X } from 'lucide-react';

interface StartScreenProps {
  onContinue: () => void;
  onStartNew: () => void;
  hasExistingProgress: boolean;
  completedCount: number;
  totalRecordingsCount: number;
  sessionNumber?: number;
  onEdit: () => void;
  sentenceCount: number;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onContinue,
  onStartNew,
  hasExistingProgress,
  completedCount,
  totalRecordingsCount,
  sessionNumber,
  onEdit,
  sentenceCount
}) => {
  const [showConfirmNew, setShowConfirmNew] = useState(false);

  return (
    <div className="flex flex-col min-h-screen px-4 py-6 max-w-lg mx-auto space-y-6 relative">
      {/* Hero Header */}
      <div className="text-center pt-2 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>ENG3088 AI & English Education</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Scene Shadow: <span className="text-amber-500">Inside Out</span>
          <span className="block text-sky-600 text-xl sm:text-2xl font-bold mt-0.5">Finding Joy</span>
        </h1>

        <p className="text-base sm:text-lg font-medium text-slate-600">
          Listen. Copy. Speak at the same time.
          <span className="block text-xs sm:text-sm text-slate-400 font-normal mt-0.5">
            듣고, 따라하고, 동시에 말하는 쉐도잉 훈련
          </span>
        </p>
      </div>

      {/* Visual character theme banner */}
      <div className="bg-gradient-to-r from-amber-400 via-amber-300 to-sky-300 p-4 rounded-2xl shadow-sm border border-amber-200/60 text-slate-900">
        <div className="space-y-1 [word-break:keep-all] break-words">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-amber-900">Movie Clip Practice</span>
            {hasExistingProgress && sessionNumber && (
              <span className="bg-amber-900/10 text-amber-950 font-bold text-[11px] px-2 py-0.5 rounded-full">
                Session #{sessionNumber}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-slate-900">슬픔이와 기쁨이의 대화</h2>
          <p className="text-xs text-slate-700">{sentenceCount} Curated Everyday Phrases · Movie Clip</p>
        </div>
      </div>

      {/* "What is shadowing?" Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-2.5">
          <BookOpen className="w-5 h-5 text-sky-500" />
          <span>What is Shadowing? / 쉐도잉이란?</span>
        </div>

        <div className="space-y-3.5 text-sm">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">1. Listen to Native Rhythm</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                원어민의 호흡, 억양(intonation), 강조 단어(stress)를 집중해서 들어요.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 mt-0.5">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">2. Speak Right with the Actor</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                그림자(shadow)처럼 배우의 말소리를 거의 동시에 따라 소리 내어 말해요.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">3. Build Speech Muscle Memory</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                짧은 문장을 반복 녹음하고 확인하며 입에 자연스럽게 영어를 붙여요.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="space-y-3 pt-2">
        {hasExistingProgress ? (
          <div className="space-y-2.5">
            {/* Continue Practice Button */}
            <button
              onClick={onContinue}
              className="w-full min-h-[56px] px-6 py-3.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 active:scale-[0.98] text-slate-950 font-bold rounded-2xl shadow-md shadow-amber-500/20 flex flex-col items-center justify-center transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2 text-lg">
                <Play className="w-5 h-5 fill-current" />
                <span>Continue Practice</span>
              </div>
              <span className="text-xs font-semibold text-amber-950/80">
                이전 학습 이어하기 (완료 {completedCount}/{sentenceCount}문장 · 녹음 {totalRecordingsCount}회)
              </span>
            </button>

            {/* Start New Practice Button */}
            <button
              onClick={() => setShowConfirmNew(true)}
              className="w-full min-h-[50px] px-5 py-2.5 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-800 font-bold rounded-2xl border border-slate-300 shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
            >
              <RotateCcw className="w-4 h-4 text-slate-600" />
              <span>Start New Practice / 새로운 회차 시작</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onContinue}
            className="w-full min-h-[54px] px-6 py-3.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 active:scale-[0.98] text-slate-950 font-bold rounded-2xl shadow-md shadow-amber-500/20 flex flex-col items-center justify-center transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2 text-lg">
              <Play className="w-5 h-5 fill-current" />
              <span>Start Practice</span>
            </div>
            <span className="text-xs font-semibold text-amber-950/80">연습 시작 ({sentenceCount}개 문장)</span>
          </button>
        )}

        <div className="text-center pt-1">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 py-2 px-3 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <Settings2 className="w-4 h-4 text-slate-400" />
            <span>Edit Sentences / 문장 편집</span>
          </button>
        </div>
      </div>

      {/* Educational Use & Source Card */}
      <div className="pt-2">
        <EducationalNoticeCard />
      </div>

      {/* Confirmation Modal for Start New Practice */}
      {showConfirmNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">새로운 회차를 시작할까요?</h3>
              </div>
              <button
                onClick={() => setShowConfirmNew(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                현재 진행 중인 학습 기록(<strong className="text-slate-800">완료 {completedCount}문장</strong>,{' '}
                <strong className="text-slate-800">총 녹음 {totalRecordingsCount}회</strong>, 자가 평가 결과)이 초기화되고, 1번 문장부터 새로운 회차가 시작됩니다.
              </p>
              <p className="text-slate-400 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                ※ 편집한 문장 내용, 한국어 번역, 강조 단어, 유튜브 영상 구간 정보는 안전하게 유지됩니다.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowConfirmNew(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                취소 (계속 유지)
              </button>
              <button
                onClick={() => {
                  setShowConfirmNew(false);
                  onStartNew();
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                새로 시작하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
