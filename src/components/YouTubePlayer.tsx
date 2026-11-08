import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { MOVIE_SETTINGS } from '../constants';
import { ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react';
import { audioDiagnostics } from '../utils/audioDiagnostics';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubePlayerHandle {
  playSegment: (start: number, end: number, onEnd?: () => void) => void;
  playFullClip: (onEnd?: () => void) => void;
  stop: () => void;
  pause: () => void;
  getCurrentTime: () => number;
  setSpeed: (rate: number) => void;
  seekTo: (seconds: number) => void;
  cueSegment: (start: number) => void;
  isReady: () => boolean;
}

interface YouTubePlayerProps {
  onTimeUpdate?: (time: number) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  isLooping?: boolean;
  playbackSpeed?: number;
  onEndedSegment?: () => void;
  className?: string;
  showCredit?: boolean;
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  (
    {
      onTimeUpdate,
      onPlayingChange,
      isLooping = false,
      playbackSpeed = 1.0,
      onEndedSegment,
      className = '',
      showCredit = true
    },
    ref
  ) => {
    const containerId = useRef(`yt-player-${Math.random().toString(36).substring(2, 9)}`);
    const playerRef = useRef<any>(null);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [, setIsPlaying] = useState(false);

    // Track active segment
    const activeSegmentRef = useRef<{
      start: number;
      end: number;
      onEnd?: () => void;
    } | null>(null);

    const isLoopingRef = useRef(isLooping);
    isLoopingRef.current = isLooping;

    const loopTimeoutRef = useRef<number | null>(null);
    const pollIntervalRef = useRef<number | null>(null);

    // Diagnostics refs
    const playRequestTimeRef = useRef<number | null>(null);
    const lastTimeRef = useRef<{ time: number; timestamp: number }>({ time: 0, timestamp: 0 });
    const bufferingStartRef = useRef<number | null>(null);
    const timeFrozenLoggedRef = useRef<boolean>(false);
    const bufferingLoggedRef = useRef<boolean>(false);

    // Clean up timers
    const clearPollInterval = () => {
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    const clearLoopTimeout = () => {
      if (loopTimeoutRef.current) {
        window.clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
    };

    const clearTimers = () => {
      clearLoopTimeout();
      clearPollInterval();
    };

    // Initialize YouTube API and Player
    useEffect(() => {
      let isMounted = true;

      const initPlayer = () => {
        if (!window.YT || !window.YT.Player) return;

        audioDiagnostics.log('YT', `Initializing YouTube Player (videoId="${MOVIE_SETTINGS.videoId}")`);

        try {
          playerRef.current = new window.YT.Player(containerId.current, {
            videoId: MOVIE_SETTINGS.videoId,
            playerVars: {
              start: Math.floor(MOVIE_SETTINGS.practiceStart),
              end: Math.ceil(MOVIE_SETTINGS.practiceEnd),
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
              controls: 1,
              cc_load_policy: 0
            },
            events: {
              onReady: () => {
                if (!isMounted) return;
                setIsPlayerReady(true);
                audioDiagnostics.log('YT', 'onReady event fired: YouTube Player is ready');
                try {
                  playerRef.current.setPlaybackRate(playbackSpeed);
                } catch (e) {
                  // ignore
                }
              },
              onStateChange: (event: any) => {
                if (!isMounted) return;
                const state = event.data;
                const stateNames: Record<number, string> = {
                  1: 'PLAYING',
                  2: 'PAUSED',
                  3: 'BUFFERING',
                  0: 'ENDED',
                  '-1': 'UNSTARTED',
                  5: 'CUED'
                };
                const stateName = stateNames[state] || `UNKNOWN(${state})`;
                let vol = 100;
                let muted = false;
                let loadedFraction = 0;
                let currTime = 0;

                try {
                  if (playerRef.current?.getVolume) vol = playerRef.current.getVolume();
                  if (playerRef.current?.isMuted) muted = playerRef.current.isMuted();
                  if (playerRef.current?.getVideoLoadedFraction) loadedFraction = playerRef.current.getVideoLoadedFraction();
                  if (playerRef.current?.getCurrentTime) currTime = playerRef.current.getCurrentTime();
                } catch (e) {}

                // Reset diagnostic flags on state change
                if (state === 3) { // BUFFERING
                  if (!bufferingStartRef.current) bufferingStartRef.current = performance.now();
                } else {
                  bufferingStartRef.current = null;
                  bufferingLoggedRef.current = false;
                }
                if (state !== 1) { // Not PLAYING
                  timeFrozenLoggedRef.current = false;
                }

                // Calculate play start latency
                if (state === 1 && playRequestTimeRef.current !== null) {
                  const latency = Math.round(performance.now() - playRequestTimeRef.current);
                  audioDiagnostics.updateState({ timeToStartPlayingMs: latency });
                  audioDiagnostics.log('YT', `Playback started: time advanced to ${currTime.toFixed(2)}s (Latency from request: ${latency}ms)`);
                  playRequestTimeRef.current = null;
                }

                audioDiagnostics.updateState({
                  ytState: stateName,
                  ytStateCode: state,
                  ytVolume: vol,
                  ytIsMuted: muted,
                  ytLoadedFraction: loadedFraction,
                  ytTime: currTime
                });

                audioDiagnostics.log('YT', `onStateChange -> ${stateName} (${state}) [time=${currTime.toFixed(2)}s, vol=${vol}%, muted=${muted}, buffered=${(loadedFraction * 100).toFixed(1)}%]`);

                // 1 = PLAYING
                if (state === 1 || state === window.YT?.PlayerState?.PLAYING) {
                  setIsPlaying(true);
                  if (onPlayingChange) onPlayingChange(true);
                  // Immediate check if native YouTube play was triggered at or past 64.6s
                  try {
                    if (playerRef.current?.getCurrentTime) {
                      const t = playerRef.current.getCurrentTime();
                      if (t >= MOVIE_SETTINGS.practiceEnd) {
                        playerRef.current.pauseVideo();
                        playerRef.current.seekTo(MOVIE_SETTINGS.practiceEnd, true);
                        setIsPlaying(false);
                        if (onPlayingChange) onPlayingChange(false);
                        clearTimers();
                        return;
                      }
                    }
                  } catch (e) {
                    // ignore
                  }
                  // Start monitoring only when video is actively playing (25ms interval)
                  startPlaybackMonitor();
                } else if (
                  state === 2 ||
                  state === 0 ||
                  state === window.YT?.PlayerState?.PAUSED ||
                  state === window.YT?.PlayerState?.ENDED
                ) {
                  setIsPlaying(false);
                  if (onPlayingChange) onPlayingChange(false);
                  // Clean up poll interval only (preserve loop timeout if segment ended)
                  clearPollInterval();
                }
              },
              onError: (event: any) => {
                if (!isMounted) return;
                console.warn('YouTube Player error:', event.data);
                audioDiagnostics.log('YT', `onError event fired with code ${event.data}`);
                // 101 or 150 = cannot embed
                if (event.data === 101 || event.data === 150 || event.data === 2) {
                  setHasError(true);
                  setErrorMessage(
                    "This video can't play inside the app. Tap to open it on YouTube."
                  );
                }
              }
            }
          });
        } catch (err) {
          console.error('Error creating YouTube player:', err);
          audioDiagnostics.log('YT', `Failed to create YouTube Player instance: ${err}`);
          if (isMounted) {
            setHasError(true);
            setErrorMessage("This video can't play inside the app. Tap to open it on YouTube.");
          }
        }
      };

      if (!window.YT) {
        audioDiagnostics.log('YT', 'Injecting YouTube IFrame API script tag...');
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.body.appendChild(tag);

        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevReady) prevReady();
          if (isMounted) initPlayer();
        };
      } else {
        initPlayer();
      }

      return () => {
        isMounted = false;
        clearTimers();
        if (playerRef.current && playerRef.current.destroy) {
          try {
            playerRef.current.destroy();
          } catch (e) {
            // ignore
          }
        }
      };
    }, []);

    // Sync playback speed changes
    useEffect(() => {
      if (isPlayerReady && playerRef.current?.setPlaybackRate) {
        try {
          playerRef.current.setPlaybackRate(playbackSpeed);
          audioDiagnostics.log('YT', `setPlaybackRate(${playbackSpeed}) applied`);
        } catch (err) {
          console.warn('Failed to set playback rate:', err);
        }
      }
    }, [playbackSpeed, isPlayerReady]);

    // Playback monitor running only while video is actively playing (25ms interval)
    const startPlaybackMonitor = () => {
      clearPollInterval();

      pollIntervalRef.current = window.setInterval(() => {
        if (!playerRef.current || !playerRef.current.getCurrentTime) return;

        try {
          const currentTime = playerRef.current.getCurrentTime();
          if (typeof currentTime !== 'number') return;

          let loadedFraction = 0;
          if (playerRef.current.getVideoLoadedFraction) {
            loadedFraction = playerRef.current.getVideoLoadedFraction();
          }

          audioDiagnostics.updateState({ ytTime: currentTime, ytLoadedFraction: loadedFraction });

          if (onTimeUpdate) {
            onTimeUpdate(currentTime);
          }

          // Diagnostic check 3: PLAYING state but time frozen
          const now = performance.now();
          if (lastTimeRef.current.time === currentTime) {
            if (now - lastTimeRef.current.timestamp > 1200 && !timeFrozenLoggedRef.current) {
              timeFrozenLoggedRef.current = true;
              audioDiagnostics.log('YT', `[DIAGNOSIS 3] PLAYING state active but video time frozen at ${currentTime.toFixed(2)}s (Buffered: ${(loadedFraction * 100).toFixed(1)}%)`);
            }
          } else {
            lastTimeRef.current = { time: currentTime, timestamp: now };
            timeFrozenLoggedRef.current = false;
          }

          // Diagnostic check 1: Stuck in BUFFERING (> 2500ms)
          if (bufferingStartRef.current && (now - bufferingStartRef.current > 2500) && !bufferingLoggedRef.current) {
            bufferingLoggedRef.current = true;
            audioDiagnostics.log('YT', `[DIAGNOSIS 1] Stuck in BUFFERING state for > 2.5s at time ${currentTime.toFixed(2)}s (Buffered: ${(loadedFraction * 100).toFixed(1)}%)`);
          }

          // 1. Enforce global practice range ceiling (64.6s)
          if (currentTime >= MOVIE_SETTINGS.practiceEnd) {
            audioDiagnostics.log('YT', `Reached practice range end ceiling (64.6s). Pausing video.`);
            playerRef.current.pauseVideo();
            playerRef.current.seekTo(MOVIE_SETTINGS.practiceEnd, true);
            clearTimers();
            setIsPlaying(false);
            if (onPlayingChange) onPlayingChange(false);

            if (activeSegmentRef.current?.onEnd) {
              const cb = activeSegmentRef.current.onEnd;
              activeSegmentRef.current = null;
              cb();
            }
            if (onEndedSegment) {
              onEndedSegment();
            }
            return;
          }

          // 2. Active sentence segment end check
          if (activeSegmentRef.current && currentTime >= activeSegmentRef.current.end) {
            const seg = activeSegmentRef.current;
            audioDiagnostics.log('YT', `Reached segment end (${seg.end}s). Pausing video.`);
            playerRef.current.pauseVideo();
            clearPollInterval();
            setIsPlaying(false);

            if (seg.onEnd) {
              seg.onEnd();
            }
            if (onEndedSegment) {
              onEndedSegment();
            }

            // Loop check
            if (isLoopingRef.current) {
              audioDiagnostics.log('YT', `Looping active: waiting 1.5s before repeating segment (${seg.start}s - ${seg.end}s)`);
              clearLoopTimeout();
              loopTimeoutRef.current = window.setTimeout(() => {
                if (isLoopingRef.current) {
                  executeSegmentPlay(seg.start, seg.end, seg.onEnd);
                } else {
                  activeSegmentRef.current = null;
                }
              }, 1500); // Wait 1.5 seconds for learner repetition
            } else {
              activeSegmentRef.current = null;
            }
            return;
          }

          // 3. Floor check (cannot play before 0s)
          if (currentTime < MOVIE_SETTINGS.practiceStart) {
            playerRef.current.seekTo(MOVIE_SETTINGS.practiceStart, true);
          }
        } catch (err) {
          // ignore transient errors
        }
      }, 25);
    };

    const executeSegmentPlay = (start: number, end: number, onEnd?: () => void) => {
      if (!playerRef.current) return;
      try {
        clearTimers();
        playRequestTimeRef.current = performance.now();
        const attemptNum = audioDiagnostics.getAttempt();
        audioDiagnostics.log('YT', `executeSegmentPlay called [Attempt #${attemptNum || 'N/A'}]: start=${start}s, end=${end}s`);

        activeSegmentRef.current = { start, end, onEnd };
        playerRef.current.seekTo(start, true);
        playerRef.current.playVideo();
        startPlaybackMonitor();
      } catch (err) {
        console.warn('Playback error:', err);
        audioDiagnostics.log('YT', `executeSegmentPlay exception: ${err}`);
      }
    };

    useImperativeHandle(ref, () => ({
      playSegment: (start: number, end: number, onEnd?: () => void) => {
        executeSegmentPlay(start, end, onEnd);
      },
      playFullClip: (onEnd?: () => void) => {
        audioDiagnostics.log('YT', `playFullClip requested: ${MOVIE_SETTINGS.practiceStart}s - ${MOVIE_SETTINGS.practiceEnd}s`);
        executeSegmentPlay(MOVIE_SETTINGS.practiceStart, MOVIE_SETTINGS.practiceEnd, onEnd);
      },
      stop: () => {
        audioDiagnostics.log('YT', 'stop() requested');
        clearTimers();
        activeSegmentRef.current = null;
        if (playerRef.current?.pauseVideo) {
          try {
            playerRef.current.pauseVideo();
          } catch (e) {
            // ignore
          }
        }
      },
      pause: () => {
        audioDiagnostics.log('YT', 'pause() requested');
        clearTimers();
        if (playerRef.current?.pauseVideo) {
          try {
            playerRef.current.pauseVideo();
          } catch (e) {
            // ignore
          }
        }
      },
      getCurrentTime: () => {
        if (playerRef.current?.getCurrentTime) {
          try {
            return playerRef.current.getCurrentTime();
          } catch (e) {
            return 0;
          }
        }
        return 0;
      },
      setSpeed: (rate: number) => {
        audioDiagnostics.log('YT', `setSpeed(${rate}) requested`);
        if (playerRef.current?.setPlaybackRate) {
          try {
            playerRef.current.setPlaybackRate(rate);
          } catch (e) {
            // ignore
          }
        }
      },
      seekTo: (seconds: number) => {
        audioDiagnostics.log('YT', `seekTo(${seconds}s) requested`);
        if (playerRef.current?.seekTo) {
          try {
            playerRef.current.seekTo(seconds, true);
          } catch (e) {
            // ignore
          }
        }
      },
      cueSegment: (start: number) => {
        audioDiagnostics.log('YT', `cueSegment(${start}s) requested`);
        clearTimers();
        activeSegmentRef.current = null;
        if (playerRef.current) {
          try {
            playerRef.current.pauseVideo();
            playerRef.current.seekTo(start, true);
            playerRef.current.pauseVideo();
          } catch (e) {
            // ignore
          }
        }
        setIsPlaying(false);
      },
      isReady: () => isPlayerReady
    }));

    return (
      <div className={`w-full bg-slate-900 ${className}`}>
        {/* 16:9 Video container */}
        <div className="relative w-full aspect-video bg-black overflow-hidden flex items-center justify-center">
          {hasError ? (
            <div className="p-4 text-center text-white flex flex-col items-center justify-center gap-3">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
              <p className="text-sm font-medium text-amber-100 max-w-xs">
                {errorMessage || "This video can't play inside the app."}
              </p>
              <a
                href={`https://www.youtube.com/watch?v=${MOVIE_SETTINGS.videoId}&t=${MOVIE_SETTINGS.practiceStart}s`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-sm font-semibold transition-colors"
              >
                <span>Tap to open on YouTube</span>
                <ExternalLink className="w-4 h-4" />
              </a>
              <p className="text-xs text-slate-400 mt-1">
                Sentences, recording, and self-check still work seamlessly!
              </p>
            </div>
          ) : (
            <>
              <div id={containerId.current} className="w-full h-full" />
              {!isPlayerReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-300 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                  <span className="text-xs font-medium tracking-wide">Loading movie clip...</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Mandatory Gray One-Line Credit Under Video */}
        {showCredit && (
          <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[13px] text-slate-400 leading-tight">
            <span>Clip: </span>
            <em className="text-slate-300 not-italic font-medium">{MOVIE_SETTINGS.titleEn}</em>
            <span> ({MOVIE_SETTINGS.releaseYear}), {MOVIE_SETTINGS.distribution} / {MOVIE_SETTINGS.production} · via YouTube · For educational use only</span>
          </div>
        )}
      </div>
    );
  }
);

YouTubePlayer.displayName = 'YouTubePlayer';
