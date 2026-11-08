import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { MOVIE_SETTINGS, ONE_LINE_CREDIT } from '../constants';
import { ExternalLink, AlertTriangle, Play, Pause, RefreshCw } from 'lucide-react';

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
    const [isPlaying, setIsPlaying] = useState(false);

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
                try {
                  playerRef.current.setPlaybackRate(playbackSpeed);
                } catch (e) {
                  // ignore
                }
              },
              onStateChange: (event: any) => {
                if (!isMounted) return;
                const state = event.data;
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
                  // Start monitoring only when video is actively playing (100ms interval)
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
          if (isMounted) {
            setHasError(true);
            setErrorMessage("This video can't play inside the app. Tap to open it on YouTube.");
          }
        }
      };

      if (!window.YT) {
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
        } catch (err) {
          console.warn('Failed to set playback rate:', err);
        }
      }
    }, [playbackSpeed, isPlayerReady]);

    // Playback monitor running only while video is actively playing (100ms interval as per PRD)
    const startPlaybackMonitor = () => {
      clearPollInterval();

      pollIntervalRef.current = window.setInterval(() => {
        if (!playerRef.current || !playerRef.current.getCurrentTime) return;

        try {
          const currentTime = playerRef.current.getCurrentTime();
          if (typeof currentTime !== 'number') return;

          if (onTimeUpdate) {
            onTimeUpdate(currentTime);
          }

          // 1. Enforce global practice range ceiling (64.6s)
          if (currentTime >= MOVIE_SETTINGS.practiceEnd) {
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
        activeSegmentRef.current = { start, end, onEnd };
        playerRef.current.seekTo(start, true);
        playerRef.current.playVideo();
        startPlaybackMonitor();
      } catch (err) {
        console.warn('Playback error:', err);
      }
    };

    useImperativeHandle(ref, () => ({
      playSegment: (start: number, end: number, onEnd?: () => void) => {
        executeSegmentPlay(start, end, onEnd);
      },
      playFullClip: (onEnd?: () => void) => {
        executeSegmentPlay(MOVIE_SETTINGS.practiceStart, MOVIE_SETTINGS.practiceEnd, onEnd);
      },
      stop: () => {
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
        if (playerRef.current?.setPlaybackRate) {
          try {
            playerRef.current.setPlaybackRate(rate);
          } catch (e) {
            // ignore
          }
        }
      },
      seekTo: (seconds: number) => {
        if (playerRef.current?.seekTo) {
          try {
            playerRef.current.seekTo(seconds, true);
          } catch (e) {
            // ignore
          }
        }
      },
      cueSegment: (start: number) => {
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
