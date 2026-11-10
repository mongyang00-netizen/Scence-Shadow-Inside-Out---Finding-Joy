import React, { useState, useEffect, useRef } from 'react';
import { Sentence, SentenceProgress, Rating } from '../types';
import { YouTubePlayer, YouTubePlayerHandle } from './YouTubePlayer';
import { SHADOWING_STEPS, SELF_CHECK_QUESTIONS } from '../constants';
import { audioDiagnostics } from '../utils/audioDiagnostics';
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
  Check,
  Sparkles,
  ArrowLeft,
  AlertCircle,
  ExternalLink,
  Loader2
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
  // Shadowing step: 1, 2, 3, or 4 (Step 1 Listen is the default starting step)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isTextHidden, setIsTextHidden] = useState<boolean>(true);
  const [isKoreanHidden, setIsKoreanHidden] = useState<boolean>(false);

  // Playback states
  const [isPlayingClip, setIsPlayingClip] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1.0);

  // Recording states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingsBySentence, setRecordingsBySentence] = useState<Record<number, string>>({});
  const [recordingBlobsBySentence, setRecordingBlobsBySentence] = useState<Record<number, Blob>>({});
  const recordingBlobUrl = recordingsBySentence[sentence.id] || null;
  const currentSentenceBlob = recordingBlobsBySentence[sentence.id] || null;
  const [isPlayingRecording, setIsPlayingRecording] = useState<boolean>(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const recordingStopTimeoutRef = useRef<number | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const recordingSessionIdRef = useRef<number>(0);
  const isStartingRecordingRef = useRef<boolean>(false);

  // Feature toggle: Set to false to disable Check My Words UI and prevent any SpeechRecognition or mic activation
  const SHOW_CHECK_MY_WORDS = false;

  // Check My Words Mode: 'stt' (File-based recorded STT, recommended for iOS) vs 'webspeech' (Live mic Web Speech API)
  const [checkMode, setCheckMode] = useState<'stt' | 'webspeech'>('stt');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isListeningSpeech, setIsListeningSpeech] = useState<boolean>(false);
  const [speechResult, setSpeechResult] = useState<{
    transcript: string;
    matchedIndices: number[];
    totalWords: number;
    source?: 'stt' | 'webspeech';
  } | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const speechHasFinishedRef = useRef<boolean>(false);
  const speechSilenceTimerRef = useRef<number | null>(null);
  const speechMaxTimeoutRef = useRef<number | null>(null);
  const speechAccumulatedTranscriptRef = useRef<string>('');

  const isSpeechSupported = typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const clearSpeechTimers = () => {
    if (speechSilenceTimerRef.current) {
      window.clearTimeout(speechSilenceTimerRef.current);
      speechSilenceTimerRef.current = null;
    }
    if (speechMaxTimeoutRef.current) {
      window.clearTimeout(speechMaxTimeoutRef.current);
      speechMaxTimeoutRef.current = null;
    }
  };

  const finishListeningSpeech = (reason: string) => {
    if (speechHasFinishedRef.current) {
      audioDiagnostics.log('SPEECH', `finishListeningSpeech ignored (already finished via: ${reason})`);
      return;
    }
    speechHasFinishedRef.current = true;
    clearSpeechTimers();

    audioDiagnostics.log('SPEECH', `finishListeningSpeech triggered via: ${reason}`);

    if (speechRecognitionRef.current) {
      try {
        audioDiagnostics.log('SPEECH', 'Calling explicit recognition.stop()...');
        speechRecognitionRef.current.stop();
      } catch (e) {
        audioDiagnostics.log('SPEECH', `Error calling explicit recognition.stop(): ${e}`);
      }
    }
  };

  // Helper function to safely & explicitly release microphone stream tracks (iOS WebKit orange dot fix)
  const releaseStreamTracks = (streamToRelease: MediaStream | null, caller: string) => {
    if (!streamToRelease) return;
    try {
      const tracks = streamToRelease.getTracks();
      tracks.forEach((track) => {
        const priorState = track.readyState;
        const priorEnabled = track.enabled;
        audioDiagnostics.log(
          'MIC',
          `Releasing track "${track.label}" (${caller}): readyState prior="${priorState}", enabled prior=${priorEnabled}`
        );
        // Explicitly set enabled = false BEFORE calling stop()
        // Critical for iOS Safari WebKit to immediately extinguish status bar orange mic indicator.
        track.enabled = false;
        track.stop();
        audioDiagnostics.log(
          'MIC',
          `Track "${track.label}" released (${caller}): final readyState="${track.readyState}", final enabled=${track.enabled}`
        );
        audioDiagnostics.updateState({
          trackReadyState: track.readyState,
          trackEnabled: track.enabled,
          trackMuted: track.muted
        });
      });
    } catch (err) {
      audioDiagnostics.log('MIC', `Error in releaseStreamTracks (${caller}): ${err}`);
    }
  };

  // Clean up any active audio tracks or speech recognition on unmount
  useEffect(() => {
    return () => {
      recordingSessionIdRef.current += 1;
      clearSpeechTimers();
      speechHasFinishedRef.current = true;

      if (activeStreamRef.current) {
        releaseStreamTracks(activeStreamRef.current, 'unmount');
        activeStreamRef.current = null;
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch (e) {}
        speechRecognitionRef.current = null;
      }
    };
  }, []);

  // Reset recording/text state, clear timers/loops, and cue player on sentence change
  useEffect(() => {
    audioDiagnostics.log('SYS', `Switched to Sentence #${sentence.id} ("${sentence.text.substring(0, 30)}...")`);

    // Clean up active speech recognition
    clearSpeechTimers();
    speechHasFinishedRef.current = true;
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }

    // 1. If currently recording or playing voice, stop immediately and safely release mic
    recordingSessionIdRef.current += 1;
    isStartingRecordingRef.current = false;
    if (recordingStopTimeoutRef.current) {
      window.clearTimeout(recordingStopTimeoutRef.current);
      recordingStopTimeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    mediaRecorderRef.current = null;

    if (activeStreamRef.current) {
      releaseStreamTracks(activeStreamRef.current, 'sentence-change');
      activeStreamRef.current = null;
    }

    // Stop ongoing learner voice audio
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }

    // 2. Reset to Step 1 (Listen) for new sentence entry while preserving saved progress
    setCurrentStep(1);
    const step1Config = SHADOWING_STEPS.find((s) => s.step === 1);
    setIsTextHidden(step1Config ? step1Config.defaultTextHidden : true);
    setIsKoreanHidden(false);
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
      audioDiagnostics.log('YT', 'handlePlayOriginal: User clicked Pause');
      playerRef.current.pause();
      setIsPlayingClip(false);
    } else {
      audioDiagnostics.log('YT', `handlePlayOriginal: User clicked Play original (${sentence.start}s - ${sentence.end}s)`);
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
    setIsLooping((prev) => {
      audioDiagnostics.log('YT', `Loop toggled to ${!prev ? 'ON' : 'OFF'}`);
      return !prev;
    });
  };

  // Stop current recording process and invalidate previous session
  const stopRecordingProcess = (reason: string = 'User request / reset') => {
    recordingSessionIdRef.current += 1;
    isStartingRecordingRef.current = false;

    audioDiagnostics.log('REC', `stopRecordingProcess called: ${reason}`);

    if (recordingStopTimeoutRef.current) {
      window.clearTimeout(recordingStopTimeoutRef.current);
      recordingStopTimeoutRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        audioDiagnostics.log('REC', `Error stopping MediaRecorder: ${e}`);
      }
    }
    mediaRecorderRef.current = null;

    if (activeStreamRef.current) {
      releaseStreamTracks(activeStreamRef.current, `stopRecordingProcess-${reason}`);
      activeStreamRef.current = null;
    }

    if (playerRef.current) {
      playerRef.current.pause();
      setIsPlayingClip(false);
    }
    setIsRecording(false);
    audioDiagnostics.updateState({ recState: 'inactive' });
  };

  // Start simultaneous Recording + Clip Playback with session isolation
  const handleStartRecording = async () => {
    const attemptStartTime = performance.now();
    const elapsed = () => `+${Math.round(performance.now() - attemptStartTime)}ms`;
    const attemptId = audioDiagnostics.incrementAttempt();
    audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] Record button clicked (isRecording=${isRecording}, isStarting=${isStartingRecordingRef.current})`);

    // Clean up active speech recognition if user starts recording
    clearSpeechTimers();
    speechHasFinishedRef.current = true;
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }

    // Diagnostics: Precheck existing HTMLAudioElement from My Voice
    if (audioElementRef.current) {
      const el = audioElementRef.current;
      const elStatus = `paused=${el.paused}, currentTime=${el.currentTime?.toFixed(2)}s, ended=${el.ended}, duration=${el.duration}`;
      audioDiagnostics.log('SESSION', `[Attempt #${attemptId}] [${elapsed()}] My Voice AudioElement precheck: ${elStatus}`);
      audioDiagnostics.updateState({ audioElementStatus: elStatus });
    } else {
      audioDiagnostics.updateState({ audioElementStatus: 'none' });
    }

    if (isRecording || isStartingRecordingRef.current) {
      // Manual stop or duplicate click handling
      stopRecordingProcess(`[Attempt #${attemptId}] User clicked stop button`);
      return;
    }

    // Completely reset any previous session before starting a new one
    stopRecordingProcess(`[Attempt #${attemptId}] Clearing previous recording session before start`);

    // STEP 0: Prime WebKit user-activation on YouTube player synchronously within user touch handler
    if (playerRef.current?.primeUserGesture) {
      playerRef.current.primeUserGesture(sentence.start);
    }

    const currentSessionId = recordingSessionIdRef.current;
    isStartingRecordingRef.current = true;

    try {
      // 1. Microphone access requested & granted FIRST (before starting video)
      audioDiagnostics.log('MIC', `[Attempt #${attemptId}] [${elapsed()}] Calling navigator.mediaDevices.getUserMedia({ audio: true })...`);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // If user clicked Stop or Record again while getUserMedia was pending, cancel this attempt
      if (recordingSessionIdRef.current !== currentSessionId) {
        audioDiagnostics.log('MIC', `[Attempt #${attemptId}] [${elapsed()}] Session invalidated while getUserMedia was pending. Releasing stream.`);
        releaseStreamTracks(stream, 'invalidated-session');
        return;
      }

      activeStreamRef.current = stream;
      setMicPermissionDenied(false);

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const settings = audioTrack.getSettings ? JSON.stringify(audioTrack.getSettings()) : 'N/A';
        audioDiagnostics.updateState({
          trackLabel: audioTrack.label,
          trackMuted: audioTrack.muted,
          trackReadyState: audioTrack.readyState,
          trackEnabled: audioTrack.enabled,
          trackSettingsSummary: settings
        });
        audioDiagnostics.log('MIC', `[Attempt #${attemptId}] [${elapsed()}] getUserMedia success: label="${audioTrack.label}", readyState="${audioTrack.readyState}", muted=${audioTrack.muted}, enabled=${audioTrack.enabled}, settings=${settings}`);

        audioTrack.onmute = () => {
          audioDiagnostics.updateState({ trackMuted: true });
          audioDiagnostics.log('MIC', `[Attempt #${attemptId}] [${elapsed()}] AudioTrack ONMUTE event fired! (Microphone muted by iOS/system)`);
        };
        audioTrack.onunmute = () => {
          audioDiagnostics.updateState({ trackMuted: false });
          audioDiagnostics.log('MIC', `[Attempt #${attemptId}] [${elapsed()}] AudioTrack ONUNMUTE event fired.`);
        };
        audioTrack.onended = () => {
          audioDiagnostics.updateState({ trackReadyState: 'ended' });
          audioDiagnostics.log('MIC', `[Attempt #${attemptId}] [${elapsed()}] AudioTrack ONENDED event fired! (Microphone stream closed unexpectedly)`);
          if (recordingSessionIdRef.current === currentSessionId && mediaRecorderRef.current?.state === 'recording') {
            try {
              mediaRecorderRef.current.stop();
            } catch (e) {}
          }
        };
      } else {
        audioDiagnostics.log('MIC', `[Attempt #${attemptId}] [${elapsed()}] WARNING: Stream returned no audio tracks!`);
      }

      // Determine optimal audio mime type
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
      const supportedType = mimeTypes.find(
        (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)
      );
      audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] Selected MediaRecorder mimeType: "${supportedType || 'browser default'}"`);
      const recorderOptions: MediaRecorderOptions = supportedType ? { mimeType: supportedType } : {};

      // 2. Create MediaRecorder instance
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      const chunkSizesHistory: number[] = [];
      let recorderStartTimestamp = 0;

      recorder.ondataavailable = (event) => {
        const chunkSize = event.data ? event.data.size : 0;
        const isCurrentSession = recordingSessionIdRef.current === currentSessionId;

        if (!isCurrentSession) {
          audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] [SESSION_MISMATCH] ondataavailable chunk (${chunkSize} B) ignored! Session #${currentSessionId} expired (active is #${recordingSessionIdRef.current})`);
          return;
        }

        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          chunkSizesHistory.push(event.data.size);
          const totalBytes = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
          const chunksStr = `[${chunkSizesHistory.map((s) => `${s}B`).join(', ')}]`;

          audioDiagnostics.updateState({
            chunksCount: audioChunksRef.current.length,
            totalBytes,
            lastChunkSizes: chunksStr
          });

          // Log all initial chunks up to 5, and then every 10th
          if (audioChunksRef.current.length <= 5 || audioChunksRef.current.length % 10 === 0) {
            const trackStatus = audioTrack ? `(track: readyState="${audioTrack.readyState}", muted=${audioTrack.muted})` : '';
            audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] ondataavailable: chunk #${audioChunksRef.current.length} = ${event.data.size} B (type="${event.data.type || 'none'}"), cumulative = ${totalBytes} B ${trackStatus}`);
          }
        } else {
          audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] ondataavailable: received 0-byte or empty chunk!`);
        }
      };

      recorder.onerror = (errEvent: any) => {
        const err = errEvent?.error;
        const errName = err?.name || errEvent?.name || 'UnknownError';
        const errMsg = err?.message || errEvent?.message || String(errEvent);
        console.warn('MediaRecorder error:', errEvent);
        audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] MediaRecorder ONERROR: name="${errName}", message="${errMsg}", state="${recorder.state}"`);
        if (recordingSessionIdRef.current === currentSessionId) {
          stopRecordingProcess(`[Attempt #${attemptId}] MediaRecorder error: ${errName}`);
        }
      };

      recorder.onstop = async () => {
        const recDurationMs = Math.round(performance.now() - (recorderStartTimestamp || attemptStartTime));
        audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] MediaRecorder ONSTOP fired. Actual duration = ${recDurationMs}ms, state="${recorder.state}"`);
        audioDiagnostics.updateState({ lastRecordingDurationMs: recDurationMs });

        if (recordingSessionIdRef.current !== currentSessionId) {
          audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] Ignored onstop (session expired: current #${currentSessionId} vs active #${recordingSessionIdRef.current})`);
          return;
        }

        setIsRecording(false);
        isStartingRecordingRef.current = false;

        // Explicitly release microphone stream tracks using helper
        releaseStreamTracks(stream, `onstop-attempt-${attemptId}`);
        activeStreamRef.current = null;

        const totalBytes = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
        const chunksSummary = `[${chunkSizesHistory.map((s) => `${s}B`).join(', ')}]`;
        audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] Recording finalized: Total captured bytes = ${totalBytes} B across ${audioChunksRef.current.length} chunks. Chunk sizes: ${chunksSummary}`);

        const audioBlob = new Blob(audioChunksRef.current, {
          type: supportedType || 'audio/webm'
        });

        // Inspect binary payload of the recorded Blob (Hex + ASCII + Header signature)
        const inspection = await audioDiagnostics.inspectBlob(audioBlob);
        audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] Blob inspection: size=${inspection.size}B, mime="${inspection.mime}", note="${inspection.signatureNote}", Hex=[${inspection.hex}], ASCII="${inspection.ascii}"`);
        audioDiagnostics.updateState({
          lastBlobHex: inspection.hex,
          lastBlobAscii: inspection.ascii,
          lastBlobSize: inspection.size,
          lastBlobMime: inspection.mime
        });

        if (totalBytes > 200) {
          const url = URL.createObjectURL(audioBlob);
          setRecordingsBySentence((prev) => ({
            ...prev,
            [sentence.id]: url
          }));
          setRecordingBlobsBySentence((prev) => ({
            ...prev,
            [sentence.id]: audioBlob
          }));

          // Invalidate previous STT result when a new recording is made
          setSpeechResult(null);
          setSpeechError(null);

          const nextStatus = currentStep === 4 ? 'done' : 'practiced';
          onUpdateProgress(sentence.id, {
            recordings: (progress?.recordings || 0) + 1,
            status: nextStatus
          });
          audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] Recording saved successfully (size=${audioBlob.size} B, type=${audioBlob.type}). Progress updated.`);
        } else {
          const failureType = totalBytes === 5 ? 'EXACT 5-BYTE CORRUPTION / HEADER-ONLY' : `UNDERSIZED (${totalBytes} B)`;
          audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] WARNING: Recording yielded <=200 bytes (${totalBytes} B). Classification: ${failureType}. Recording discarded.`);
          console.warn('Recording yielded insufficient audio bytes. Progress count preserved.');
        }
      };

      // 3. Trigger YouTube video segment playback ONLY AFTER microphone is confirmed & active
      let videoTriggered = false;
      const triggerVideoPlayback = () => {
        if (videoTriggered || recordingSessionIdRef.current !== currentSessionId) return;
        videoTriggered = true;

        audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] Triggering YouTube video segment play (${sentence.start}s - ${sentence.end}s)...`);

        if (playerRef.current) {
          setIsPlayingClip(true);
          // Always play segment starting cleanly from sentence.start
          playerRef.current.playSegment(sentence.start, sentence.end, () => {
            if (recordingSessionIdRef.current !== currentSessionId) {
              audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] [LATE_CALLBACK] YouTube segment callback for Attempt #${attemptId} arrived after session invalidated!`);
              return;
            }
            audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] Sentence segment playback finished. Scheduling recording stop in 1.0s...`);
            setIsPlayingClip(false);

            // PRD rule: Recording stops exactly 1.0 second after sentence ends
            recordingStopTimeoutRef.current = window.setTimeout(() => {
              if (recordingSessionIdRef.current === currentSessionId && mediaRecorderRef.current?.state === 'recording') {
                audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] 1.0s post-sentence timer fired. Calling MediaRecorder.stop().`);
                try {
                  mediaRecorderRef.current.stop();
                } catch (e) {
                  audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] Error stopping MediaRecorder on timer: ${e}`);
                }
              } else {
                audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] 1.0s timer fired but recorder state was "${mediaRecorderRef.current?.state || 'null'}" or session changed.`);
              }
            }, 1000);
          });
        }
      };

      recorder.onstart = () => {
        recorderStartTimestamp = performance.now();
        const trackNow = audioTrack ? `track.readyState="${audioTrack.readyState}", muted=${audioTrack.muted}, enabled=${audioTrack.enabled}` : 'no track';
        audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] MediaRecorder ONSTART event fired. State="${recorder.state}", mime="${recorder.mimeType}", ${trackNow}`);
        audioDiagnostics.updateState({ recState: 'recording' });
        if (recordingSessionIdRef.current === currentSessionId) {
          triggerVideoPlayback();
        }
      };

      // Start recording
      audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] Calling MediaRecorder.start(50)...`);
      recorder.start(50);
      setIsRecording(true);

      // Safeguard fallback in case browser skips or delays onstart event
      setTimeout(() => {
        if (recordingSessionIdRef.current === currentSessionId && !videoTriggered && mediaRecorderRef.current?.state === 'recording') {
          audioDiagnostics.log('REC', `[Attempt #${attemptId}] [${elapsed()}] Safeguard fallback triggered video playback (onstart event delayed or omitted by browser)`);
          triggerVideoPlayback();
        }
      }, 50);

    } catch (err: any) {
      console.warn('Microphone error:', err);
      audioDiagnostics.log('MIC', `[Attempt #${attemptId}] [${elapsed()}] Exception in handleStartRecording: ${err?.name || err} - ${err?.message || err}`);
      if (recordingSessionIdRef.current === currentSessionId) {
        setMicPermissionDenied(true);
        stopRecordingProcess(`[Attempt #${attemptId}] Microphone permission or access exception`);
      }
    }
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
      audioDiagnostics.log('REC', 'Voice audio paused by user.');
      audioDiagnostics.updateState({ audioElementStatus: 'paused by user' });
      return;
    }

    audioDiagnostics.log('REC', `Playing recorded voice audio (src="${recordingBlobUrl}")...`);
    const audio = new Audio(recordingBlobUrl);
    audioElementRef.current = audio;
    setIsPlayingRecording(true);
    audioDiagnostics.updateState({ audioElementStatus: 'playing' });

    audio.onplay = () => {
      audioDiagnostics.log('REC', 'Voice audio onplay: playback started.');
      audioDiagnostics.updateState({ audioElementStatus: 'playing' });
    };

    audio.onended = () => {
      audioDiagnostics.log('REC', 'Voice audio onended: playback finished cleanly.');
      audioDiagnostics.updateState({ audioElementStatus: 'ended (clean)' });
      setIsPlayingRecording(false);
    };

    audio.onerror = (e) => {
      audioDiagnostics.log('REC', `Voice audio onerror: ${e}`);
      audioDiagnostics.updateState({ audioElementStatus: 'error' });
      setIsPlayingRecording(false);
    };

    audio.play().catch((err) => {
      console.warn('Playback error:', err);
      audioDiagnostics.log('REC', `Voice audio play() rejected: ${err}`);
      audioDiagnostics.updateState({ audioElementStatus: `play rejected: ${err}` });
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

  // Words to practice (Self-assessment: learner chooses words to practice more)
  const handleToggleWordToPractice = (idx: number) => {
    const current = progress?.practiceWords || [];
    const updated = current.includes(idx)
      ? current.filter((i) => i !== idx)
      : [...current, idx].sort((a, b) => a - b);
    onUpdateProgress(sentence.id, {
      practiceWords: updated
    });
  };

  // Helper to evaluate words against target sentence
  const evaluateTranscriptAgainstSentence = (rawTranscript: string, source: 'stt' | 'webspeech') => {
    const cleanTranscript = (rawTranscript || '').trim();
    if (!cleanTranscript) {
      setSpeechError('Could not catch speech from audio. Please speak clearly into the mic!');
      return;
    }

    const targetWords = sentence.text.split(/\s+/).map((w) =>
      w.toLowerCase().replace(/[^a-z0-9']/g, '')
    );
    const spokenWords = cleanTranscript.split(/\s+/).map((w: string) =>
      w.toLowerCase().replace(/[^a-z0-9']/g, '')
    );

    const matchedIndices: number[] = [];
    targetWords.forEach((word, idx) => {
      if (word && spokenWords.includes(word)) {
        matchedIndices.push(idx);
      }
    });

    setSpeechResult({
      transcript: cleanTranscript,
      matchedIndices,
      totalWords: targetWords.filter((w) => w.length > 0).length,
      source
    });
    audioDiagnostics.log('SPEECH', `[${source.toUpperCase()}] Evaluated: matched ${matchedIndices.length} / ${targetWords.length} words`);
  };

  // Helper to convert audio Blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // strip data url prefix e.g. "data:audio/webm;base64,"
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // 1. File-based STT using recorded audio Blob (No mic activation, solves iOS Safari mic lockup)
  const handleCheckWordsWithSTT = async () => {
    audioDiagnostics.log('SPEECH', 'Check My Words (STT mode) clicked');
    setSpeechError(null);

    if (!currentSentenceBlob || currentSentenceBlob.size < 200) {
      setSpeechError('Please record your voice first using the Record button above! / 먼저 위 Record 버튼으로 녹음해 주세요.');
      return;
    }

    setIsTranscribing(true);
    setSpeechResult(null);

    try {
      const base64Audio = await blobToBase64(currentSentenceBlob);
      const mimeType = currentSentenceBlob.type || 'audio/webm';
      audioDiagnostics.log('SPEECH', `Sending audio blob to /api/transcribe (size=${currentSentenceBlob.size} B, mimeType="${mimeType}")`);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType,
          sentenceText: sentence.text,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'GEMINI_API_KEY_NOT_CONFIGURED') {
          throw new Error('Server GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in environment variables.');
        }
        throw new Error(data.message || `Server transcription failed (${response.status})`);
      }

      const transcribedText = data.transcript || '';
      audioDiagnostics.log('SPEECH', `STT transcription received: "${transcribedText}"`);

      if (!transcribedText.trim()) {
        setSpeechError('No speech was detected in your recording. Please try recording again speaking clearly! / 녹음에서 목소리가 감지되지 않았습니다.');
      } else {
        evaluateTranscriptAgainstSentence(transcribedText, 'stt');
      }
    } catch (err: any) {
      console.warn('STT transcription error:', err);
      audioDiagnostics.log('SPEECH', `STT error: ${err?.message || err}`);
      setSpeechError(`STT Error: ${err?.message || 'Failed to transcribe recording'}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // 2. Original live mic Web Speech recognition (Preserved 100% for rollback or direct comparison)
  const handleCheckWordsLive = () => {
    audioDiagnostics.log('SPEECH', 'Check My Words live mic clicked (Web Speech API)');

    if (!isSpeechSupported) {
      audioDiagnostics.log('SPEECH', 'Web Speech API is not supported on this browser');
      setSpeechError('Web Speech API is not supported on this browser.');
      return;
    }

    // 1. Completely stop and release any active MediaRecorder or getUserMedia stream tracks FIRST
    stopRecordingProcess('Clearing active MediaRecorder/stream before starting Speech Recognition');

    // 2. Clear previous speech timers & reset termination guards
    clearSpeechTimers();
    speechHasFinishedRef.current = false;
    speechAccumulatedTranscriptRef.current = '';

    // 3. Abort any un-ended SpeechRecognition instance from a previous run
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      speechRecognitionRef.current = recognition;

      // Mode B proven pattern for iOS WebKit & Android: continuous=true & interimResults=true
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      setIsListeningSpeech(true);
      setSpeechError(null);
      setSpeechResult(null);
      audioDiagnostics.updateState({ speechState: 'initializing' });

      // Mode B initial 8.0s max timeout safeguard (if user makes no sound after tapping)
      speechMaxTimeoutRef.current = window.setTimeout(() => {
        audioDiagnostics.log('SPEECH', '8.0s initial max timeout fired (no sound detected)');
        finishListeningSpeech('8.0s initial max timeout');
      }, 8000);

      // Comprehensive WebSpeech API event lifecycle diagnostics
      recognition.onstart = () => {
        audioDiagnostics.log('SPEECH', 'onstart: SpeechRecognition engine started');
        setIsListeningSpeech(true);
        audioDiagnostics.updateState({ speechState: 'listening' });
      };

      recognition.onaudiostart = () => {
        audioDiagnostics.log('SPEECH', 'onaudiostart: Audio capture stream opened by SpeechRecognition');
      };

      recognition.onsoundstart = () => {
        audioDiagnostics.log('SPEECH', 'onsoundstart: Sound input detected');
      };

      recognition.onspeechstart = () => {
        audioDiagnostics.log('SPEECH', 'onspeechstart: Speech pattern detected');
      };

      recognition.onspeechend = () => {
        audioDiagnostics.log('SPEECH', 'onspeechend: Speech pattern ended');
      };

      recognition.onsoundend = () => {
        audioDiagnostics.log('SPEECH', 'onsoundend: Sound input ended');
      };

      recognition.onaudioend = () => {
        audioDiagnostics.log('SPEECH', 'onaudioend: Audio capture stream ended by browser engine');
      };

      recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            finalText += text;
          } else {
            interimText += text;
          }
        }

        const currentCaptured = (finalText || interimText || '').trim();
        if (currentCaptured) {
          speechAccumulatedTranscriptRef.current = currentCaptured;
          audioDiagnostics.log('SPEECH', `onresult: currentTranscript="${currentCaptured}" (isFinal=${!!finalText})`);

          // Reset 1.5s silence timer on every speech result in Mode B
          if (speechSilenceTimerRef.current) {
            window.clearTimeout(speechSilenceTimerRef.current);
          }
          speechSilenceTimerRef.current = window.setTimeout(() => {
            audioDiagnostics.log('SPEECH', '1.5s silence timer fired after last spoken word');
            finishListeningSpeech('1.5s silence timeout');
          }, 1500);
        }
      };

      recognition.onerror = (e: any) => {
        const errType = e?.error || 'unknown';
        const errMessage = e?.message || '';
        audioDiagnostics.log('SPEECH', `onerror: error="${errType}", message="${errMessage}"`);

        speechHasFinishedRef.current = true;
        clearSpeechTimers();
        setIsListeningSpeech(false);
        audioDiagnostics.updateState({ speechState: `error:${errType}` });

        if (errType === 'not-allowed' || errType === 'service-not-allowed') {
          setSpeechError('Microphone permission for Speech Recognition was not allowed. / 마이크 권한이 허용되지 않았습니다.');
        } else if (errType === 'audio-capture') {
          setSpeechError('Microphone hardware was busy. Please tap Check My Words again. / 마이크 장치가 사용 중입니다. 다시 시도해 주세요.');
        } else if (errType === 'no-speech') {
          setSpeechError('No speech was detected. Please speak clearly into the mic! / 음성이 감지되지 않았습니다.');
        } else if (errType === 'network') {
          setSpeechError('Network connection needed for speech recognition. / 네트워크 연결을 확인해 주세요.');
        } else if (errType === 'aborted') {
          setSpeechError('Speech recognition was canceled.');
        } else {
          setSpeechError('Could not catch your voice. Please try speaking clearly into the mic!');
        }
      };

      recognition.onend = () => {
        audioDiagnostics.log('SPEECH', 'onend: SpeechRecognition session closed. Evaluating target word match...');
        speechHasFinishedRef.current = true;
        clearSpeechTimers();
        setIsListeningSpeech(false);
        audioDiagnostics.updateState({ speechState: 'idle' });
        speechRecognitionRef.current = null;

        evaluateTranscriptAgainstSentence(speechAccumulatedTranscriptRef.current, 'webspeech');
      };

      audioDiagnostics.log('SPEECH', 'Calling recognition.start() in Mode B...');
      recognition.start();
    } catch (err: any) {
      console.warn('Recognition start error:', err);
      audioDiagnostics.log('SPEECH', `Exception starting SpeechRecognition: ${err?.name || err} - ${err?.message || err}`);
      speechHasFinishedRef.current = true;
      clearSpeechTimers();
      setIsListeningSpeech(false);
      audioDiagnostics.updateState({ speechState: 'error' });
      setSpeechError('Speech recognition was unavailable. Please try again.');
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

        {/* Words to Practice / 추가 연습 단어 (Learner self-assessment) */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-slate-900">
                Words to Practice / 추가 연습 단어
              </span>
            </div>
            {(progress?.practiceWords && progress.practiceWords.length > 0) ? (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300">
                {progress.practiceWords.length}개 선택됨
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">선택형 자기 점검</span>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-700">
              Listen to your recording and select the words you want to practice more.
            </p>
            <p className="text-[11px] text-slate-400">
              내 녹음을 듣고 더 연습하고 싶은 단어를 선택해 보세요.
            </p>
          </div>

          {/* Word Chips */}
          <div className="flex flex-wrap gap-2 pt-1">
            {sentenceWords.map((word, idx) => {
              const isSelected = (progress?.practiceWords || []).includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleToggleWordToPractice(idx)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-sm transition-all cursor-pointer flex items-center gap-1.5 border select-none active:scale-95 ${
                    isSelected
                      ? 'bg-amber-100/95 text-amber-950 border-amber-400 font-bold shadow-xs ring-1 ring-amber-400/40'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300 font-medium'
                  }`}
                  title={isSelected ? '선택 해제' : '추가 연습 단어로 선택'}
                >
                  <span>{word}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-amber-700 stroke-[2.5]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer guidance / Clear all */}
          {(progress?.practiceWords && progress.practiceWords.length > 0) ? (
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
              <span className="text-slate-500">
                선택한 단어는 Finish 화면에 정리되어 다시 연습할 수 있습니다.
              </span>
              <button
                type="button"
                onClick={() => onUpdateProgress(sentence.id, { practiceWords: [] })}
                className="text-slate-400 hover:text-slate-600 underline cursor-pointer shrink-0 ml-2"
              >
                선택 초기화
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 pt-0.5">
              ※ 단어를 누르면 선택/해제됩니다. 자신 있게 발화한 문장이라면 선택하지 않고 넘어가도 좋습니다.
            </p>
          )}
        </div>

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
