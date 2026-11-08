import React from 'react';
import { EducationalNoticeCard } from './EducationalNoticeCard';
import { Play, Sparkles, BookOpen, Settings2, Headphones, Mic, Volume2 } from 'lucide-react';
import { MOVIE_SETTINGS } from '../constants';

interface StartScreenProps {
  onStart: () => void;
  onEdit: () => void;
  sentenceCount: number;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onStart, onEdit, sentenceCount }) => {
  return (
    <div className="flex flex-col min-h-screen px-4 py-6 max-w-lg mx-auto space-y-6">
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
          <span className="text-xs uppercase font-bold tracking-wider text-amber-900">Movie Clip Practice</span>
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
        <button
          onClick={onStart}
          className="w-full min-h-[54px] px-6 py-3.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 active:scale-[0.98] text-slate-950 font-bold rounded-2xl shadow-md shadow-amber-500/20 flex flex-col items-center justify-center transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2 text-lg">
            <Play className="w-5 h-5 fill-current" />
            <span>Start Practice</span>
          </div>
          <span className="text-xs font-semibold text-amber-950/80">연습 시작 ({sentenceCount}개 문장)</span>
        </button>

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
    </div>
  );
};
