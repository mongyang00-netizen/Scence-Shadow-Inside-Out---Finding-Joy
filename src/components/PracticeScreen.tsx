import React, { useState, useEffect, useRef } from 'react';
import { Sentence, SentenceProgress, Rating } from '../types';
import { YouTubePlayer, YouTubePlayerHandle } from './YouTubePlayer';
import { SHADOWING_STEPS, SELF_CHECK_QUESTIONS } from '../constants';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Repeat,
  Mic,
  Square,
  Volume2,
  Eye,
  EyeOff,
  CheckCircle,
  Sparkles,
  ArrowLeft,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  ExternalLink
} from 'lucide-react';

interface PracticeScreenProps {
  sentence: Sentence;
  currentIndex: number;
  totalSentences: number;
  progress: SentenceProgress;
  onUpdateProgress: (id: number, update: Partial<SentenceProgress>) => void;
  onPrev: () => void;
  onNext: () => void;
  onBackToList: () => void;
  onFinish: () => void;
  playerRef: React.RefObject<YouTubePlayerHandle | null>;
}

export const PracticeScreen: React.FC<PracticeScreenProps> = ({
  sentence,
  currentIndex,
  totalSentences,
  progress,
  onUpdateProgress,
  onPrev,
  onNext,
  onBackToList,
  onFinish,
  playerRef
}) => {
  // Shadowing step: 1, 2, 3, or 4
  const [currentStep, setCurrentStep] = useState<number>(3);
  const [isTextHidden, setIsTextHidden] = useState<boolean>(false);
  const [isKoreanHidden, setIsKoreanHidden] = useState<boolean>(false);

  // Playback states
  const [isPlayingClip, setIsPlayingClip] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1.0);

  // Recording states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingsBySentence, setRecordingsBySentence] = useState<Record<number, string>>({});
  const recordingBlobUrl = recordingsBySentence[sentence.id] || null;
  const [isPlayingRecording, setIsPlayingRecording] = useState<boolean>(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const recordingStopTimeoutRef = useRef<number | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  // Web Speech recognition state
  const [isListeningSpeech, setIsListeningSpeech] = useState<boolean>(false);
  const [speechResult, setSpeechResult] = useState<{
    transcript: string;
    matchedIndices: number[];
    totalWords: number;
  } | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const isSpeechSupported = typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Clean up any active audio tracks on unmount
  useEffect(() => {
    return () => {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
        activeStreamRef.current = null;
      }
    };
  }, []);

  // Reset recording/text state, clear timers/loops, and cue player on sentence change
  useEffect(() => {
    // 1. If currently recording or playing voice, stop immediately and safely release mic
    if (recordingStopTimeoutRef.current) {
      window.clearTimeout(recordingStopTimeoutRef.current);
      recordingStopTimeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }

    // Stop ongoing learner voice audio
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }

    // 2. Reset UI, playback, and loop states for new sentence
    const stepConfig = SHADOWING_STEPS.find((s) => s.step === currentStep);
    setIsTextHidden(stepConfig ? stepConfig.defaultTextHidden : false);
    setIsPlayingClip(false);
    setIsRecording(false);
    setIsPlayingRecording(false);
    setIsLooping(false); // Reset Loop to OFF for new sentence
    setSpeechResult(null);
    setSpeechError(null);

    // 3. Stop previous video playback and cue new sentence in PAUSED state
    if (playerRef.current) {
      if (playerRef.current.cueSegment) {
        playerRef.current.cueSegment(sentence.start);
      } else {
        playerRef.current.stop();
        playerRef.current.seekTo(sentence.start);
        playerRef.current.pause();
      }
    }
  }, [sentence.id]);

  // When step changes, update default text visibility
  const handleStepChange = (stepNum: number) => {
    setCurrentStep(stepNum);
    const stepConfig = SHADOWING_STEPS.find((s) => s.step === stepNum);
    if (stepConfig) {
      setIsTextHidden(stepConfig.defaultTextHidden);
    }
  };

  // Play original sentence segment
  const handlePlayOriginal = () => {
    if (!playerRef.current) return;

    if (isPlayingClip) {
      playerRef.current.pause();
      setIsPlayingClip(false);
    } else {
      setIsPlayingClip(true);
      playerRef.current.playSegment(sentence.start, sentence.end, () => {
        setIsPlayingClip(false);
        // Increment play count
        onUpdateProgress(sentence.id, {
          plays: (progress?.plays || 0) + 1
        });
      });
    }
  };

  // Speed changer
  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (playerRef.current) {
      playerRef.current.setSpeed(newSpeed);
    }
  };

  // Toggle Loop
  const handleToggleLoop = () => {
    setIsLooping((prev) => !prev);
  };

  // Start simultaneous Recording + Clip Playback immediately on button press
  const handleStartRecording = async () => {
    if (isRecording) {
      // Manual stop
      stopRecordingProcess();
      return;
    }

    try {
      // 1. Freshly request microphone stream upon Record button press (no persistent or pre-warmed stream)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;
      setMicPermissionDenied(false);

      // Determine optimal audio mime type
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
      const supportedType = mimeTypes.find(
        (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)
      );
      const recorderOptions: MediaRecorderOptions = supportedType ? { mimeType: supportedType } : {};

      // 2. Create MediaRecorder
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (errEvent: any) => {
        console.warn('MediaRecorder error:', errEvent);
        setIsRecording(false);
        if (activeStreamRef.current) {
          activeStreamRef.current.getTracks().forEach((track) => track.stop());
          activeStreamRef.current = null;
        }
      };

      recorder.onstop = () => {
        setIsRecording(false);

        // ALWAYS stop and release microphone stream tracks immediately when recording ends
        stream.getTracks().forEach((track) => track.stop());
        activeStreamRef.current = null;

        // Only save recording and increment count if valid audio data was captured (> 200 bytes)
        const totalBytes = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
        if (totalBytes > 200) {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: supportedType || 'audio/webm'
          });
          const url = URL.createObjectURL(audioBlob);
          setRecordingsBySentence((prev) => ({
            ...prev,
            [sentence.id]: url
          }));

          // Update progress status: "done" if step 4, else "practiced"
          const nextStatus = currentStep === 4 ? 'done' : 'practiced';
          onUpdateProgress(sentence.id, {
            recordings: (progress?.recordings || 0) + 1,
            status: nextStatus
          });
        } else {
          console.warn('Recording yielded insufficient audio bytes on iOS/browser. Progress count preserved.');
        }
      };

      // Handle track interruption on iOS (e.g. phone call or backgrounding)
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try {
              mediaRecorderRef.current.stop();
            } catch (e) {}
          }
        };
      }

      // 3. Trigger video playback once recording has actively commenced
      let videoTriggered = false;
      const triggerVideoPlayback = () => {
        if (videoTriggered) return;
        videoTriggered = true;

        if (playerRef.current) {
          setIsPlayingClip(true);
          // Loop is ignored during recording
          playerRef.current.playSegment(sentence.start, sentence.end, () => {
            setIsPlayingClip(false);

            // PRD rule: Recording stops exactly 1.0 second after sentence ends
            recordingStopTimeoutRef.current = window.setTimeout(() => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                try {
                  mediaRecorderRef.current.stop();
                } catch (e) {}
              }
            }, 1000);
          });
        }
      };

      // Video playback starts after recorder is actively running
      recorder.onstart = () => {
        triggerVideoPlayback();
      };

      // Start recording immediately
      recorder.start(50);
      setIsRecording(true);

      // Safeguard timeout in case browser skips or delays onstart event
      setTimeout(() => {
        if (!videoTriggered && mediaRecorderRef.current?.state === 'recording') {
          triggerVideoPlayback();
        }
      }, 50);

    } catch (err) {
      console.warn('Microphone error:', err);
      setMicPermissionDenied(true);
      setIsRecording(false);
    }
  };

  const stopRecordingProcess = () => {
    if (recordingStopTimeoutRef.current) {
      window.clearTimeout(recordingStopTimeoutRef.current);
      recordingStopTimeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    // Stop all active microphone tracks and release hardware immediately
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.pause();
      setIsPlayingClip(false);
    }
    setIsRecording(false);
  };

  // Play learner's voice recording
  const handlePlayMyVoice = () => {
    if (!recordingBlobUrl) return;

    if (isPlayingRecording) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      }
      setIsPlayingRecording(false);
      return;
    }

    const audio = new Audio(recordingBlobUrl);
    audioElementRef.current = audio;
    setIsPlayingRecording(true);

    audio.onended = () => {
      setIsPlayingRecording(false);
    };

    audio.onerror = () => {
      setIsPlayingRecording(false);
    };

    audio.play().catch((err) => {
      console.warn('Playback error:', err);
      setIsPlayingRecording(false);
    });
  };

  // Self check question rating
  const handleRateQuestion = (questionIdx: number, rating: Rating) => {
    const currentCheck = progress?.selfCheck ? [...progress.selfCheck] : [null, null, null];
    currentCheck[questionIdx] = rating;
    onUpdateProgress(sentence.id, {
      selfCheck: currentCheck as [Rating, Rating, Rating]
    });
  };

  // Web Speech recognition (Check My Words)
  const handleCheckWords = () => {
    if (!isSpeechSupported) return;

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListeningSpeech(true);
      setSpeechError(null);
      setSpeechResult(null);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListeningSpeech(false);

        // Normalize words and compare
        const targetWords = sentence.text.split(/\s+/).map((w) =>
          w.toLowerCase().replace(/[^a-z0-9']/g, '')
        );
        const spokenWords = transcript.split(/\s+/).map((w: string) =>
          w.toLowerCase().replace(/[^a-z0-9']/g, '')
        );

        const matchedIndices: number[] = [];
        targetWords.forEach((word, idx) => {
          if (word && spokenWords.includes(word)) {
            matchedIndices.push(idx);
          }
        });

        setSpeechResult({
          transcript,
          matchedIndices,
          totalWords: targetWords.filter((w) => w.length > 0).length
        });
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
        setIsListeningSpeech(false);
        setSpeechError('Could not catch your voice. Please try speaking clearly into the mic!');
      };

      recognition.onend = () => {
        setIsListeningSpeech(false);
      };

      recognition.start();
    } catch (err) {
      console.warn('Recognition start error:', err);
      setIsListeningSpeech(false);
      setSpeechError('Speech recognition was unavailable.');
    }
  };

  const isLastSentence = currentIndex === totalSentences - 1;
  const isJoy = sentence.speaker.toLowerCase().includes('joy');
  const activeStepInfo = SHADOWING_STEPS.find((s) => s.step === currentStep) || SHADOWING_STEPS[2];

  // Helper to render words with stress highlighting
  const sentenceWords = sentence.text.split(' ');

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 max-w-lg mx-auto pb-16">
      {/* Top Bar with back, counter, and list buttons */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <button
          onClick={onBackToList}
          className="p-2 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>List / 목록</span>
        </button>

        {/* Sentence Counter with Prev/Next arrows */}
        <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200/80">
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="p-1 rounded-full text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-600"
            title="Previous sentence"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-800">
            Sentence {currentIndex + 1} / {totalSentences}
          </span>
          <button
            onClick={onNext}
            disabled={isLastSentence}
            className="p-1 rounded-full text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-600"
            title="Next sentence"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            isJoy
              ? 'bg-amber-100 text-amber-900 border border-amber-200'
              : 'bg-sky-100 text-sky-900 border border-sky-200'
          }`}
        >
          {sentence.speaker}
        </span>
      </div>

      {/* 16:9 Video Player + One-line credit under video */}
      <YouTubePlayer
        ref={playerRef}
        isLooping={isLooping && !isRecording}
        playbackSpeed={speed}
        onPlayingChange={(playing) => setIsPlayingClip(playing)}
      />

      {/* Step Guide Tabs (4 tabs in order) */}
      <div className="bg-white border-b border-slate-200 p-2 shadow-xs">
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
          {SHADOWING_STEPS.map((s) => {
            const isActive = currentStep === s.step;
            return (
              <button
                key={s.step}
                onClick={() => handleStepChange(s.step)}
                className={`py-2 px-1 rounded-lg text-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-950 font-bold shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="text-[10px] sm:text-[11px] font-bold leading-tight break-words [word-break:keep-all] hyphens-none">
                  {s.titleEn}
                </div>
                <div className="text-[9px] text-slate-400 font-normal leading-tight mt-0.5 break-words [word-break:keep-all]">
                  {s.titleKo}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Step Short Instruction line */}
        <div className="mt-2 px-2.5 py-2 bg-amber-50/70 rounded-lg border border-amber-100 text-xs flex items-center justify-between text-amber-950">
          <div className="leading-snug pr-2 [word-break:keep-all] break-words">
            <span className="font-semibold text-amber-900">{activeStepInfo.instructionEn} </span>
            <span className="text-[11px] text-amber-800/80 block sm:inline">({activeStepInfo.instructionKo})</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded shrink-0 self-start sm:self-center">
            Step {currentStep}
          </span>
        </div>
      </div>

      {/* Main Sentence Display Card */}
      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-3 relative">
          {/* Header row: Hide Text toggle */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Target Sentence / 목표 문장
            </span>
            <button
              onClick={() => setIsTextHidden(!isTextHidden)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
            >
              {isTextHidden ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-sky-600" />
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

          {/* Large Sentence Text (at least 22px) */}
          <div className="min-h-[70px] flex items-center justify-center text-center px-2 py-2">
            {isTextHidden ? (
              <div className="text-slate-400 text-sm italic flex flex-col items-center gap-1.5 py-3 [word-break:keep-all] break-words">
                <EyeOff className="w-6 h-6 text-slate-300" />
                <span className="font-medium">Text hidden for shadowing focus</span>
                <span className="text-xs text-slate-400">자막이 숨겨져 있습니다. 소리에 집중해보세요!</span>
              </div>
            ) : (
              <p className="text-[22px] sm:text-[24px] font-medium text-slate-900 leading-[1.8] sm:leading-[1.85] tracking-normal break-words [word-break:keep-all] py-1">
                {sentenceWords.map((word, wIdx) => {
                  const cleanWord = word.toLowerCase().replace(/[^a-z']/g, '');
                  const isStressed = sentence.stress.some(
                    (st) => st.toLowerCase().replace(/[^a-z']/g, '') === cleanWord
                  );
                  return (
                    <span
                      key={wIdx}
                      className={
                        isStressed
                          ? 'font-black text-slate-950 underline decoration-amber-400 decoration-[3px] underline-offset-[7px] [text-decoration-skip-ink:none] bg-amber-100/70 px-1 py-0.5 rounded-sm inline-block my-0.5'
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

          {/* Korean Meaning (small, gray, toggleable) */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            {isKoreanHidden ? (
              <span className="text-slate-400 italic">Korean translation hidden</span>
            ) : (
              <span className="text-slate-500 font-normal">{sentence.korean}</span>
            )}
            <button
              onClick={() => setIsKoreanHidden(!isKoreanHidden)}
              className="text-[11px] text-slate-400 hover:text-slate-700 underline underline-offset-2 shrink-0 ml-2"
            >
              {isKoreanHidden ? 'Show meaning' : 'Hide meaning'}
            </button>
          </div>
        </div>

        {/* Playback Control Row: Play, Loop, Speed */}
        <div className="bg-white rounded-2xl p-3 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-2">
          {/* Play/Pause Button */}
          <button
            onClick={handlePlayOriginal}
            className={`min-h-[48px] px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
              isPlayingClip
                ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-300'
                : 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm'
            }`}
          >
            {isPlayingClip ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause / 정지</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Play / 재생</span>
              </>
            )}
          </button>

          {/* Loop toggle */}
          <button
            onClick={handleToggleLoop}
            className={`min-h-[48px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              isLooping
                ? 'bg-sky-500 text-white border-sky-600 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
            title="Repeat sentence with 1.5s pause"
          >
            <Repeat className={`w-4 h-4 ${isLooping ? 'animate-spin-slow' : ''}`} />
            <span>Loop / 반복 {isLooping ? 'ON' : 'OFF'}</span>
          </button>

          {/* Speed Buttons: 0.5x, 0.75x, 1.0x */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {[0.5, 0.75, 1.0].map((sVal) => (
              <button
                key={sVal}
                onClick={() => handleSpeedChange(sVal)}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                  speed === sVal
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sVal}×
              </button>
            ))}
          </div>
        </div>

        {/* Mic Permission Denied & Preview Environment Notice */}
        {micPermissionDenied && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-950 text-xs shadow-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 w-full">
              <p className="font-bold text-sm text-amber-900">
                Mic is off. You can still listen and shadow out loud.
              </p>
              <p className="text-amber-800/90 leading-relaxed [word-break:keep-all]">
                마이크 권한이 꺼져 있거나 허용되지 않았습니다. 권한이 꺼져 있어도 영상을 들으며 큰 목소리로 쉐도잉 연습을 계속할 수 있습니다!
              </p>
              <div className="pt-2 border-t border-amber-200/80 space-y-2">
                <p className="text-[11px] text-amber-900 leading-relaxed [word-break:keep-all]">
                  미리보기 환경에서는 마이크 녹음이 제한될 수 있습니다. 앱을 새 탭에서 열고 마이크 접근 권한을 허용한 뒤 다시 시도해 주세요.
                </p>
                <div>
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950 font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                  >
                    <span>새 탭에서 앱 열기 / Open in New Tab</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Record & Voice Comparison Area */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Mic className="w-4 h-4 text-rose-500" />
              <span>Voice Shadowing & Recording / 녹음</span>
            </div>
            {progress?.recordings > 0 && (
              <span className="text-xs text-slate-500 font-medium">
                Recorded <strong className="text-slate-900">{progress.recordings}</strong> times
              </span>
            )}
          </div>

          {/* Primary Record Button */}
          <div className="flex flex-col items-center justify-center gap-2">
            <button
              onClick={handleStartRecording}
              className={`w-full min-h-[52px] rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.98] cursor-pointer ${
                isRecording
                  ? 'bg-rose-500 text-white animate-pulse ring-4 ring-rose-200'
                  : 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-rose-500/20'
              }`}
            >
              {isRecording ? (
                <>
                  <Square className="w-5 h-5 fill-current" />
                  <span>Recording... Tap to stop / 녹음 중 (탭하여 정지)</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  <span>Record / 동시 녹음 시작</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-400 text-center">
              {isRecording
                ? '문장 재생이 끝나고 1초 뒤 자동으로 녹음이 멈춥니다.'
                : '버튼을 누르면 영상이 재생되며 내 목소리가 함께 녹음됩니다.'}
            </p>
          </div>

          {/* Audio comparison: My Voice & Original Buttons */}
          {recordingBlobUrl && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-xs font-semibold text-slate-500 block">
                Compare with Original / 내 목소리와 원본 비교:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handlePlayMyVoice}
                  className={`min-h-[46px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border ${
                    isPlayingRecording
                      ? 'bg-rose-500 text-white border-rose-600'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-200'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{isPlayingRecording ? 'Playing My Voice...' : '▶ My Voice / 내 목소리'}</span>
                </button>

                <button
                  onClick={handlePlayOriginal}
                  className="min-h-[46px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>▶ Original / 원본 듣기</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Word Check (Web Speech API) */}
        {isSpeechSupported && (
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Sparkles className="w-4 h-4 text-sky-500" />
                <span>Word Check / 단어 일치 확인</span>
              </div>
              <button
                onClick={handleCheckWords}
                disabled={isListeningSpeech}
                className="px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Mic className="w-3.5 h-3.5 text-sky-600" />
                <span>{isListeningSpeech ? 'Listening...' : 'Check My Words'}</span>
              </button>
            </div>

            {isListeningSpeech && (
              <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 text-center space-y-1 animate-pulse">
                <p className="text-xs font-semibold text-sky-900">
                  Speak this sentence out loud into your mic now!
                </p>
                <p className="text-[11px] text-sky-700">마이크에 대고 영어 문장을 또박또박 말해보세요.</p>
              </div>
            )}

            {speechError && (
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800">
                {speechError}
              </div>
            )}

            {speechResult && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="text-xs font-medium text-slate-500">
                  Pronunciation match:
                </div>
                {/* Word matching display */}
                <div className="text-base font-semibold leading-relaxed flex flex-wrap gap-1.5">
                  {sentenceWords.map((word, idx) => {
                    const isMatched = speechResult.matchedIndices.includes(idx);
                    return isMatched ? (
                      <span
                        key={idx}
                        className="text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded font-bold"
                      >
                        {word}
                      </span>
                    ) : (
                      <span
                        key={idx}
                        className="text-slate-400 underline decoration-slate-400 decoration-2 underline-offset-4 px-1"
                      >
                        {word}
                      </span>
                    );
                  })}
                </div>

                <div className="text-xs font-semibold text-slate-700 pt-1 border-t border-slate-200 flex items-center justify-between">
                  <span>
                    You said <strong className="text-emerald-700">{speechResult.matchedIndices.length}</strong> of{' '}
                    <strong>{speechResult.totalWords}</strong> words.
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {speechResult.matchedIndices.length >= Math.ceil(speechResult.totalWords * 0.7)
                      ? 'Awesome rhythm!'
                      : 'Good effort! Keep shadowing!'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Self-Check Questions (😀 / 🙂 / 😐) */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Self-Check / 스스로 점검하기</span>
            </span>
            <span className="text-[11px] text-slate-400 font-medium">부담 없이 정직하게 체크하세요</span>
          </div>

          <div className="space-y-3">
            {SELF_CHECK_QUESTIONS.map((q) => {
              const currentRating = progress?.selfCheck ? progress.selfCheck[q.id] : null;
              return (
                <div
                  key={q.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between gap-3"
                >
                  <div className="text-xs space-y-0.5 pr-2">
                    <p className="font-semibold text-slate-800">{q.textEn}</p>
                    <p className="text-[11px] text-slate-500">{q.textKo}</p>
                  </div>

                  {/* 3 Rating Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleRateQuestion(q.id, 'happy')}
                      className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-xl transition-all cursor-pointer ${
                        currentRating === 'happy'
                          ? 'bg-amber-400 scale-110 shadow-sm ring-2 ring-amber-300'
                          : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-400'
                      }`}
                      title="Great / 아주 잘했어요"
                    >
                      😀
                    </button>
                    <button
                      onClick={() => handleRateQuestion(q.id, 'smile')}
                      className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-xl transition-all cursor-pointer ${
                        currentRating === 'smile'
                          ? 'bg-sky-400 scale-110 shadow-sm ring-2 ring-sky-300'
                          : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-400'
                      }`}
                      title="Good / 괜찮았어요"
                    >
                      🙂
                    </button>
                    <button
                      onClick={() => handleRateQuestion(q.id, 'neutral')}
                      className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-xl transition-all cursor-pointer ${
                        currentRating === 'neutral'
                          ? 'bg-slate-300 scale-110 shadow-sm ring-2 ring-slate-400'
                          : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-400'
                      }`}
                      title="Needs more practice / 조금 더 연습 필요"
                    >
                      😐
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Navigation: Next Sentence or Finish */}
        <div className="pt-2">
          {isLastSentence ? (
            <button
              onClick={onFinish}
              className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-base shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
            >
              <span>Finish Practice & Review / 학습 완료 및 결과 보기</span>
              <Sparkles className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={onNext}
              className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-bold text-base shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
            >
              <span>Next Sentence / 다음 문장으로</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
