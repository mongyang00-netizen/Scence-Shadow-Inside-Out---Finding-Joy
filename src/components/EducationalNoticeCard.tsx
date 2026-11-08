import React from 'react';
import {
  MOVIE_SETTINGS,
  EDUCATIONAL_NOTICE_EN,
  EDUCATIONAL_NOTICE_KO,
  ONE_LINE_CREDIT
} from '../constants';
import { ExternalLink, ShieldCheck, Film, BookOpen } from 'lucide-react';

export const EducationalNoticeCard: React.FC = () => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const rem = secs % 60;
    const s = Number.isInteger(rem)
      ? rem.toString().padStart(2, '0')
      : (rem < 10 ? '0' : '') + rem.toFixed(1);
    return `${m}:${s}`;
  };

  const rangeStr = `${formatTime(MOVIE_SETTINGS.practiceStart)} – ${formatTime(MOVIE_SETTINGS.practiceEnd)}`;

  return (
    <div className="bg-slate-900/90 text-slate-300 rounded-2xl p-5 border border-slate-800 text-sm shadow-md">
      <div className="flex items-center gap-2 mb-3 text-amber-400 font-semibold text-base">
        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
        <span>Educational Use & Source / 교육용 고지 및 출처</span>
      </div>

      {/* Bilingual notice */}
      <div className="space-y-2 text-xs leading-relaxed text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 mb-4">
        <p className="font-medium text-slate-200">
          <span className="text-amber-300 font-bold block mb-0.5">Educational use only / 교육 목적 전용</span>
          {EDUCATIONAL_NOTICE_EN}
        </p>
        <p className="text-slate-400 pt-1.5 border-t border-slate-800/60">
          {EDUCATIONAL_NOTICE_KO}
        </p>
      </div>

      {/* Source Details Grid */}
      <div className="text-xs space-y-1.5 text-slate-300">
        <div className="flex items-start justify-between py-0.5 border-b border-slate-800/50">
          <span className="text-slate-400">Movie Title / 영화 제목:</span>
          <span className="font-medium text-white text-right">
            {MOVIE_SETTINGS.titleEn} ({MOVIE_SETTINGS.titleKo})
          </span>
        </div>
        <div className="flex items-center justify-between py-0.5 border-b border-slate-800/50">
          <span className="text-slate-400">Release Year / 개봉 연도:</span>
          <span className="text-white">{MOVIE_SETTINGS.releaseYear}</span>
        </div>
        <div className="flex items-center justify-between py-0.5 border-b border-slate-800/50">
          <span className="text-slate-400">Director / 감독:</span>
          <span className="text-white">{MOVIE_SETTINGS.director}</span>
        </div>
        <div className="flex items-start justify-between py-0.5 border-b border-slate-800/50">
          <span className="text-slate-400">Screenplay / 각본:</span>
          <span className="text-white text-right">{MOVIE_SETTINGS.screenplay}</span>
        </div>
        <div className="flex items-center justify-between py-0.5 border-b border-slate-800/50">
          <span className="text-slate-400">Production / 제작:</span>
          <span className="text-white">{MOVIE_SETTINGS.production}</span>
        </div>
        <div className="flex items-center justify-between py-0.5 border-b border-slate-800/50">
          <span className="text-slate-400">Distribution / 배급:</span>
          <span className="text-white">{MOVIE_SETTINGS.distribution}</span>
        </div>
        <div className="flex items-center justify-between py-0.5 border-b border-slate-800/50">
          <span className="text-slate-400">Scene / 장면:</span>
          <span className="text-white">{MOVIE_SETTINGS.sceneDescription}</span>
        </div>
        <div className="flex items-start justify-between py-0.5 border-b border-slate-800/50">
          <span className="text-slate-400">YouTube Video / 클립:</span>
          <span className="text-white text-right max-w-[220px] break-words [word-break:keep-all]">{MOVIE_SETTINGS.youtubeTitle}</span>
        </div>
        <div className="flex items-center justify-between py-0.5 border-b border-slate-800/50">
          <span className="text-slate-400">YouTube Channel / 채널:</span>
          <span className="text-white">{MOVIE_SETTINGS.youtubeChannel}</span>
        </div>
        <div className="flex items-center justify-between py-0.5 border-b border-slate-800/50">
          <span className="text-slate-400">Practice Range / 학습 구간:</span>
          <span className="text-amber-300 font-mono font-medium">{rangeStr}</span>
        </div>
        <div className="flex items-center justify-between py-0.5 border-b border-slate-800/50">
          <span className="text-slate-400">Made by / 제작:</span>
          <span className="text-sky-300 font-medium">{MOVIE_SETTINGS.madeBy}</span>
        </div>
        <div className="pt-2 flex justify-end">
          <a
            href={MOVIE_SETTINGS.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors"
          >
            <span>Open Original Clip on YouTube</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};

export const OneLineCredit: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`text-[13px] text-slate-500 text-center leading-relaxed ${className}`}>
      {ONE_LINE_CREDIT}
    </div>
  );
};
