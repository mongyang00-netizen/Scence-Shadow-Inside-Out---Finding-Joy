import React, { useEffect, useState } from 'react';
import { audioDiagnostics, DiagnosticLog, DiagnosticState } from '../utils/audioDiagnostics';
import { Activity, Trash2, ChevronDown, ChevronUp, Copy, Check, Volume2, Mic, Sparkles } from 'lucide-react';

export const AudioDiagnosticsPanel: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [state, setState] = useState<DiagnosticState>({
    attemptCounter: 0,
    ytState: 'UNINITIALIZED',
    ytStateCode: -2,
    ytTime: 0,
    ytVolume: 100,
    ytIsMuted: false,
    ytLoadedFraction: 0,
    timeToStartPlayingMs: null,
    audioSessionSupported: false,
    audioSessionType: 'N/A',
    audioSessionState: 'N/A',
    recState: 'inactive',
    recMime: '',
    trackLabel: 'N/A',
    trackMuted: false,
    trackReadyState: 'N/A',
    trackEnabled: false,
    chunksCount: 0,
    totalBytes: 0,
    speechState: 'idle'
  });

  useEffect(() => {
    const enabled = audioDiagnostics.checkEnabled();
    setIsEnabled(enabled);
    if (!enabled) return;

    const unsubscribe = audioDiagnostics.subscribe((newLogs, newState) => {
      setLogs(newLogs);
      setState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleCopyLogs = async () => {
    const success = await audioDiagnostics.copyLogsToClipboard();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isEnabled) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-2 pointer-events-none max-w-lg mx-auto">
      <div className="bg-slate-900/95 backdrop-blur-md text-slate-100 border border-slate-700 shadow-2xl rounded-2xl overflow-hidden pointer-events-auto text-xs font-mono">
        {/* Header bar */}
        <div className="bg-slate-800 px-3 py-2 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-bold text-slate-200 text-xs">iOS Safari Audio Diagnostics</span>
            <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold">
              ?debugAudio=1
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleCopyLogs}
              className="p-1 px-2 text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded flex items-center gap-1 transition-colors text-[10px] font-sans font-medium"
              title="Copy formatted logs to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Logs'}</span>
            </button>
            <button
              onClick={() => audioDiagnostics.clearLogs()}
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-700 transition-colors"
              title="Clear Logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-700 transition-colors"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Panel Body */}
        {!isMinimized && (
          <div className="p-3 space-y-3 max-h-[340px] overflow-y-auto leading-tight">
            {/* Real-time Status Cards */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {/* YouTube State Card */}
              <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700 space-y-1">
                <div className="text-slate-400 font-sans font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-sky-400" />
                    <span>YouTube Player</span>
                  </div>
                  {state.attemptCounter > 0 && (
                    <span className="text-[10px] text-amber-300 font-mono">Attempt #{state.attemptCounter}</span>
                  )}
                </div>
                <div className="text-slate-200 font-bold">
                  Status:{' '}
                  <span className={state.ytStateCode === 1 ? 'text-emerald-400' : state.ytStateCode === 3 ? 'text-amber-400 animate-pulse' : state.ytStateCode === 2 ? 'text-amber-300' : 'text-slate-300'}>
                    {state.ytState}
                  </span>
                </div>
                <div>Time: {state.ytTime.toFixed(2)}s</div>
                <div>Buffered: {(state.ytLoadedFraction * 100).toFixed(1)}%</div>
                <div>Vol: {state.ytVolume}% | Muted: {state.ytIsMuted ? 'YES' : 'NO'}</div>
                <div>Start Latency: {state.timeToStartPlayingMs !== null ? `${state.timeToStartPlayingMs}ms` : 'N/A'}</div>
              </div>

              {/* Mic, Recorder & Speech Card */}
              <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700 space-y-1">
                <div className="text-slate-400 font-sans font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Mic className="w-3 h-3 text-rose-400" />
                    <span>Mic & Speech</span>
                  </div>
                </div>
                <div className="text-slate-200 font-bold">
                  Recorder:{' '}
                  <span className={state.recState === 'recording' ? 'text-rose-400 animate-pulse' : 'text-slate-300'}>
                    {state.recState}
                  </span>
                </div>
                <div>Track Muted: <span className={state.trackMuted ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{state.trackMuted ? 'YES (Silent!)' : 'NO'}</span></div>
                <div>
                  Speech Recognition:{' '}
                  <span className={state.speechState === 'listening' ? 'text-sky-400 font-bold animate-pulse' : 'text-slate-300'}>
                    {state.speechState}
                  </span>
                </div>
                <div>Size: {state.totalBytes} B ({state.chunksCount} chunks)</div>
                <div className="truncate text-[10px] text-slate-400">Label: {state.trackLabel}</div>
              </div>
            </div>

            {/* AudioSession Info */}
            <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700 text-[11px] flex items-center justify-between">
              <span className="text-slate-400 font-sans font-semibold">AudioSession API:</span>
              <span className="text-slate-200 font-semibold">{state.audioSessionType}</span>
            </div>

            {/* Timestamped Log Entries */}
            <div className="space-y-1 pt-1 border-t border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Real-Time Event Logs ({logs.length})</span>
                <span className="text-slate-500 font-normal text-[9px]">Newest first</span>
              </div>
              {logs.length === 0 ? (
                <div className="text-slate-500 italic text-[11px] py-1">No audio events logged yet. Press Play, Record or Check My Words.</div>
              ) : (
                <div className="space-y-1 font-mono text-[10px]">
                  {logs.map((log) => {
                    const categoryColors: Record<string, string> = {
                      YT: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
                      MIC: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                      REC: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                      SPEECH: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                      SESSION: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                      SYS: 'bg-slate-700 text-slate-300 border-slate-600'
                    };
                    return (
                      <div key={log.id} className="p-1 rounded bg-slate-800/40 border border-slate-700/50 flex items-start gap-1.5 leading-tight">
                        <span className="text-slate-500 shrink-0">{log.timestamp}</span>
                        <span className={`px-1 py-0.2 rounded text-[9px] font-bold border shrink-0 ${categoryColors[log.category] || categoryColors.SYS}`}>
                          {log.category}
                        </span>
                        <span className="text-slate-200 break-all">{log.message}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
