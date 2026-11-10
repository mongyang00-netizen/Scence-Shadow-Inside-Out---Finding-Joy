import React, { useState } from 'react';
import { Sentence } from '../types';
import { YouTubePlayer, YouTubePlayerHandle } from './YouTubePlayer';
import { MOVIE_SETTINGS, INITIAL_SENTENCES } from '../constants';
import {
  ArrowLeft,
  Plus,
  Play,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  Download,
  Upload,
  AlertTriangle,
  Check,
  RotateCcw,
  Edit2,
  X
} from 'lucide-react';

interface EditSentencesScreenProps {
  sentences: Sentence[];
  onSaveSentences: (sentences: Sentence[]) => void;
  onBack: () => void;
  playerRef: React.RefObject<YouTubePlayerHandle | null>;
}

export const EditSentencesScreen: React.FC<EditSentencesScreenProps> = ({
  sentences,
  onSaveSentences,
  onBack,
  playerRef
}) => {
  // Form fields
  const [editingId, setEditingId] = useState<number | null>(null);
  const [speaker, setSpeaker] = useState('Joy');
  const [text, setText] = useState('');
  const [korean, setKorean] = useState('');
  const [stressInput, setStressInput] = useState('');
  const [start, setStart] = useState<number>(0);
  const [end, setEnd] = useState<number>(3.0);

  // Notifications / feedback & Modals
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const duration = Math.max(0, end - start);
  const hasDurationWarning = duration > 4.0;
  const hasWordCountWarning = wordCount > 12;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    window.setTimeout(() => setFeedback(null), 3000);
  };

  // Set Start = now
  const handleSetStartNow = () => {
    if (playerRef.current) {
      const current = parseFloat(playerRef.current.getCurrentTime().toFixed(2));
      setStart(current);
      if (end <= current) {
        setEnd(parseFloat((current + 2.0).toFixed(2)));
      }
      showToast(`Start time set to ${current}s`);
    }
  };

  // Set End = now
  const handleSetEndNow = () => {
    if (playerRef.current) {
      const current = parseFloat(playerRef.current.getCurrentTime().toFixed(2));
      setEnd(current);
      showToast(`End time set to ${current}s`);
    }
  };

  // Test segment
  const handleTestSegment = () => {
    if (playerRef.current) {
      playerRef.current.playSegment(start, end);
    }
  };

  // Reset form
  const handleClearForm = () => {
    setEditingId(null);
    setSpeaker('Joy');
    setText('');
    setKorean('');
    setStressInput('');
    setStart(0);
    setEnd(3.0);
  };

  // Load sentence into form for editing
  const handleEditSentence = (s: Sentence) => {
    setEditingId(s.id);
    setSpeaker(s.speaker);
    setText(s.text);
    setKorean(s.korean);
    setStressInput(s.stress.join(', '));
    setStart(s.start);
    setEnd(s.end);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  // Submit Add / Edit
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim()) {
      showToast('Please enter the English sentence.', 'error');
      return;
    }
    if (start < MOVIE_SETTINGS.practiceStart || start > MOVIE_SETTINGS.practiceEnd) {
      showToast(`Start time must be between ${MOVIE_SETTINGS.practiceStart}s and ${MOVIE_SETTINGS.practiceEnd}s.`, 'error');
      return;
    }
    if (end <= start) {
      showToast('End time must be greater than start time.', 'error');
      return;
    }
    if (end > MOVIE_SETTINGS.practiceEnd) {
      showToast(`End time cannot exceed practice end (${MOVIE_SETTINGS.practiceEnd}s).`, 'error');
      return;
    }

    const stressWords = stressInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let updatedList: Sentence[];

    if (editingId !== null) {
      updatedList = sentences.map((item) =>
        item.id === editingId
          ? {
              ...item,
              speaker: speaker.trim() || 'Speaker',
              text: text.trim(),
              korean: korean.trim(),
              stress: stressWords,
              start,
              end
            }
          : item
      );
      showToast('Sentence updated!');
    } else {
      const newId = sentences.length > 0 ? Math.max(...sentences.map((s) => s.id)) + 1 : 1;
      const newSentence: Sentence = {
        id: newId,
        speaker: speaker.trim() || 'Speaker',
        text: text.trim(),
        korean: korean.trim(),
        stress: stressWords,
        start,
        end
      };
      updatedList = [...sentences, newSentence];
      showToast('New sentence added!');
    }

    onSaveSentences(updatedList);
    handleClearForm();
  };

  // Delete sentence
  const handleDeleteClick = (id: number) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmId === null) return;
    const filtered = sentences.filter((s) => s.id !== deleteConfirmId);
    onSaveSentences(filtered);
    if (editingId === deleteConfirmId) handleClearForm();
    showToast('Sentence deleted.');
    setDeleteConfirmId(null);
  };

  // Reorder up
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const copy = [...sentences];
    const temp = copy[index];
    copy[index] = copy[index - 1];
    copy[index - 1] = temp;
    onSaveSentences(copy);
  };

  // Reorder down
  const handleMoveDown = (index: number) => {
    if (index === sentences.length - 1) return;
    const copy = [...sentences];
    const temp = copy[index];
    copy[index] = copy[index + 1];
    copy[index + 1] = temp;
    onSaveSentences(copy);
  };

  // Reset to default
  const handleConfirmResetToDefault = () => {
    onSaveSentences(INITIAL_SENTENCES);
    handleClearForm();
    showToast('Reset to default sentences.');
    setShowResetModal(false);
  };

  // Export JSON
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(sentences, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      showToast('Sentences JSON copied to clipboard!');
    }).catch(() => {
      showToast('Failed to copy. Please allow clipboard permissions.', 'error');
    });
  };

  // Import JSON
  const handleExecuteImport = () => {
    setImportError(null);
    try {
      const parsed = JSON.parse(importJsonText);
      if (!Array.isArray(parsed)) {
        throw new Error('JSON must be an array of sentences.');
      }
      for (const item of parsed) {
        if (!item.text || typeof item.start !== 'number' || typeof item.end !== 'number') {
          throw new Error('Each sentence must have text, start, and end properties.');
        }
      }
      onSaveSentences(parsed);
      setShowImportModal(false);
      setImportJsonText('');
      showToast(`Successfully imported ${parsed.length} sentences!`);
    } catch (err: any) {
      setImportError(`Invalid JSON format: ${err.message || 'Please check the structure.'}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 max-w-lg mx-auto pb-16">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1 text-xs font-semibold"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back / 돌아가기</span>
        </button>

        <h2 className="text-base font-bold text-slate-900">Edit Sentences / 문장 편집</h2>

        <div className="w-8" />
      </div>

      {/* Video Player (16:9) + Credit */}
      <YouTubePlayer ref={playerRef} />

      {/* Floating feedback toast */}
      {feedback && (
        <div
          className={`mx-4 mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Add/Edit Sentence Form */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-amber-500" />
              <span>{editingId !== null ? 'Edit Sentence' : 'Add New Sentence'}</span>
            </span>
            {editingId !== null && (
              <button
                onClick={handleClearForm}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Cancel edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmitForm} className="space-y-3.5">
            {/* Speaker quick buttons */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Speaker / 화자
              </label>
              <div className="flex items-center gap-2">
                {['Joy', 'Sadness', 'Bing Bong', 'Disgust'].map((spk) => (
                  <button
                    type="button"
                    key={spk}
                    onClick={() => setSpeaker(spk)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      speaker === spk
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {spk}
                  </button>
                ))}
              </div>
            </div>

            {/* English Text */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                English Sentence / 영어 문장 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. There's always a way to turn things around."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                required
              />
            </div>

            {/* Korean Meaning */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Korean Meaning / 한국어 뜻
              </label>
              <input
                type="text"
                value={korean}
                onChange={(e) => setKorean(e.target.value)}
                placeholder="e.g. 언제나 상황을 바꿀 방법이 있어."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
              />
            </div>

            {/* Stress Words */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stress Words / 강세 단어 (쉼표 구분)
              </label>
              <input
                type="text"
                value={stressInput}
                onChange={(e) => setStressInput(e.target.value)}
                placeholder="e.g. always, turn, around"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                입력한 단어는 연습 화면에서 굵은 글씨로 강조됩니다.
              </span>
            </div>

            {/* Time Settings with "Set Start = now" & "Set End = now" */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                <span>Time Interval (0s - {MOVIE_SETTINGS.practiceEnd}s) / 구간 설정</span>
              </span>

              <div className="grid grid-cols-2 gap-3">
                {/* Start Time */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600 font-medium">Start (초):</span>
                    <button
                      type="button"
                      onClick={handleSetStartNow}
                      className="text-[11px] text-sky-600 hover:text-sky-800 font-bold underline"
                    >
                      Set Start = now
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={MOVIE_SETTINGS.practiceEnd}
                    value={start}
                    onChange={(e) => setStart(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>

                {/* End Time */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600 font-medium">End (초):</span>
                    <button
                      type="button"
                      onClick={handleSetEndNow}
                      className="text-[11px] text-sky-600 hover:text-sky-800 font-bold underline"
                    >
                      Set End = now
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={MOVIE_SETTINGS.practiceEnd}
                    value={end}
                    onChange={(e) => setEnd(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Test Segment Button */}
              <div className="pt-1 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Duration: <strong className="text-slate-800">{duration.toFixed(1)}s</strong> ({wordCount} words)
                </span>
                <button
                  type="button"
                  onClick={handleTestSegment}
                  className="px-3 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-900 text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Test / 구간 재생</span>
                </button>
              </div>

              {/* Gentle Shadowing Rules Warning */}
              {(hasDurationWarning || hasWordCountWarning) && (
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-1.5 text-[11px] text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Tip: Sentences over 4 seconds ({duration.toFixed(1)}s) or 12 words ({wordCount} words) may be challenging for learners to shadow in one breath.
                  </span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 min-h-[46px] py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-sm active:scale-[0.99] cursor-pointer"
              >
                {editingId !== null ? 'Update Sentence / 문장 수정 저장' : 'Add Sentence / 문장 추가'}
              </button>
            </div>
          </form>
        </div>

        {/* Current List & Reordering */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-sm font-bold text-slate-900">
              Current Sentences ({sentences.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportJson}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1"
                title="Copy JSON to clipboard"
              >
                <Download className="w-3 h-3" />
                <span>Export JSON</span>
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1"
                title="Paste JSON"
              >
                <Upload className="w-3 h-3" />
                <span>Import JSON</span>
              </button>
            </div>
          </div>

          {sentences.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-xs">
              No sentences. Add one above or reset to defaults.
            </div>
          ) : (
            <div className="space-y-2">
              {sentences.map((s, idx) => (
                <div
                  key={s.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-1.5">
                    {/* Reorder Up/Down */}
                    <div className="flex flex-col">
                      <button
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === sentences.length - 1}
                        className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    <div className="text-left text-xs space-y-0.5 pr-1 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{s.speaker}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {s.start}s - {s.end}s
                        </span>
                      </div>
                      <p className="font-medium text-slate-800 break-words [word-break:keep-all]">{s.text}</p>
                    </div>
                  </div>

                  {/* Actions: Edit, Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEditSentence(s)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/80 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(s.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reset to default */}
          <div className="pt-2 text-center">
            <button
              onClick={() => setShowResetModal(true)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 py-2 px-3 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset to default sentences / 기본 문장으로 복원</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-rose-600 font-bold">
                <Trash2 className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">문장 삭제</h3>
              </div>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              선택한 문장을 정말 삭제하시겠습니까? 삭제 후에는 목록에서 제거됩니다.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset to Default Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-amber-600 font-bold">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">기본 문장 복원</h3>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              원래의 인사이드아웃 문장 목록으로 복원하시겠습니까? 현재 추가 또는 수정한 문장 정보가 기본 문장 목록으로 재설정됩니다.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleConfirmResetToDefault}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                복원하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Import Sentences JSON</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Paste a JSON array containing sentences with text, start, and end properties.
            </p>

            {importError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 leading-relaxed">
                {importError}
              </div>
            )}

            <textarea
              value={importJsonText}
              onChange={(e) => {
                setImportJsonText(e.target.value);
                setImportError(null);
              }}
              placeholder='[ { "id": 1, "speaker": "Joy", "text": "...", "korean": "...", "stress": [], "start": 0, "end": 2 } ]'
              rows={8}
              className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportError(null);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteImport}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
