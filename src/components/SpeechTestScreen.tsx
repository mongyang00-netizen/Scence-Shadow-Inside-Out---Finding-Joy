import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Mic, Square, Trash2, Copy, Check, Activity, AlertCircle, RefreshCw } from 'lucide-react';

interface SpeechLogEntry {
  id: number;
  timestamp: string;
  event: string;
  details?: string;
}

interface SpeechTestScreenProps {
  onBack: () => void;
}

export const SpeechTestScreen: React.FC<SpeechTestScreenProps> = ({ onBack }) => {
  const [testMode, setTestMode] = useState<'A' | 'B'>('A');
  const [logs, setLogs] = useState<SpeechLogEntry[]>([]);
  const [speechState, setSpeechState] = useState<string>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const nextLogIdRef = useRef<number>(1);

  // Mode B guards & timers
  const hasFinishedRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<number | null>(null);
  const maxTimeoutRef = useRef<number | null>(null);

  const isSupported = typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const clearTimers = () => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxTimeoutRef.current) {
      window.clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
  };

  const addLog = (event: string, details?: string) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const newEntry: SpeechLogEntry = {
      id: nextLogIdRef.current++,
      timestamp: timeStr,
      event,
      details
    };
    setLogs((prev) => [newEntry, ...prev.slice(0, 200)]);
  };

  const finishListeningB = (reason: string) => {
    if (hasFinishedRef.current) {
      addLog(`[Mode B] finishListening ignored (already finished by previous trigger)`);
      return;
    }
    hasFinishedRef.current = true;
    clearTimers();

    addLog(`[Mode B] finishListening triggered via: ${reason}`);

    if (recognitionRef.current) {
      try {
        addLog(`[Mode B] Calling explicit recognition.stop()...`);
        recognitionRef.current.stop();
      } catch (e) {
        addLog(`[Mode B] Error calling recognition.stop(): ${e}`);
      }
    }
  };

  const handleStartSpeech = () => {
    if (!isSupported) {
      setErrorMsg('Web Speech API (SpeechRecognition) is not supported in this browser.');
      return;
    }

    clearTimers();
    hasFinishedRef.current = false;

    // Stop any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    const nextAttempt = attemptCount + 1;
    setAttemptCount(nextAttempt);
    setSpeechState('starting');
    setTranscript('');
    setInterimTranscript('');
    setErrorMsg(null);

    addLog(`=== [Attempt #${nextAttempt}] Starting Test Mode ${testMode} ===`);

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.lang = 'en-US';

      if (testMode === 'A') {
        // Mode A: Current Shadowing App style (Natural Auto-End)
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        addLog(`[Mode A] Configured: continuous=false, interimResults=false (Natural Auto-End)`);
      } else {
        // Mode B: Earlier Speaking App style (Explicit stop() + 1.5s Silence Timer + hasFinishedRef)
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        addLog(`[Mode B] Configured: continuous=true, interimResults=true, 1.5s silence timer, hasFinishedRef guard`);

        // Mode B initial 8s max timeout
        maxTimeoutRef.current = window.setTimeout(() => {
          addLog(`[Mode B] 8.0s initial max timeout fired`);
          finishListeningB('8.0s initial max timeout');
        }, 8000);
      }

      recognition.onstart = () => {
        setSpeechState('listening');
        addLog(`[Attempt #${nextAttempt}] onstart: Engine active`);
      };

      recognition.onaudiostart = () => {
        addLog(`[Attempt #${nextAttempt}] onaudiostart: Mic hardware stream opened`);
      };

      recognition.onsoundstart = () => {
        addLog(`[Attempt #${nextAttempt}] onsoundstart: Sound detected`);
      };

      recognition.onspeechstart = () => {
        addLog(`[Attempt #${nextAttempt}] onspeechstart: Speech pattern detected`);
      };

      recognition.onspeechend = () => {
        addLog(`[Attempt #${nextAttempt}] onspeechend: Speech pattern ended`);
      };

      recognition.onsoundend = () => {
        addLog(`[Attempt #${nextAttempt}] onsoundend: Sound input ended`);
      };

      recognition.onaudioend = () => {
        addLog(`[Attempt #${nextAttempt}] onaudioend: Audio stream capture ended by browser engine`);
      };

      recognition.onresult = (e: any) => {
        if (testMode === 'A') {
          // Mode A: Final single result
          const text = e.results?.[0]?.[0]?.transcript || '';
          const conf = e.results?.[0]?.[0]?.confidence ?? 0;
          setTranscript(text);
          addLog(`[Mode A] onresult: "${text}" (conf=${(conf * 100).toFixed(0)}%)`);
        } else {
          // Mode B: Continuous interim + final results processing
          let interimText = '';
          let finalText = '';

          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i];
            const text = res[0]?.transcript || '';
            if (res.isFinal) {
              finalText += text;
            } else {
              interimText += text;
            }
          }

          const currentCaptured = finalText || interimText;
          if (currentCaptured) {
            setTranscript(currentCaptured);
            setInterimTranscript(interimText);
            addLog(`[Mode B] onresult: text="${currentCaptured}" (isFinal=${!!finalText})`);

            // Reset 1.5s silence timer on every speech result in Mode B
            if (silenceTimerRef.current) {
              window.clearTimeout(silenceTimerRef.current);
            }
            silenceTimerRef.current = window.setTimeout(() => {
              addLog(`[Mode B] 1.5s silence timer fired after last speech input`);
              finishListeningB('1.5s silence timeout');
            }, 1500);
          }
        }
      };

      recognition.onerror = (e: any) => {
        const errType = e?.error || 'unknown';
        const msg = e?.message || '';
        setSpeechState(`error:${errType}`);
        addLog(`[Attempt #${nextAttempt}] onerror: type="${errType}", message="${msg}"`);

        if (testMode === 'B') {
          hasFinishedRef.current = true;
          clearTimers();
        }
      };

      recognition.onend = () => {
        setSpeechState('ended');
        addLog(`[Attempt #${nextAttempt}] onend: Session closed. Check iPhone Orange Mic dot!`);

        if (testMode === 'B') {
          hasFinishedRef.current = true;
          clearTimers();
        }

        recognitionRef.current = null;
      };

      recognition.start();
    } catch (err: any) {
      setSpeechState('error');
      addLog(`[Attempt #${nextAttempt}] Exception calling start(): ${err?.name || err} - ${err?.message || err}`);
      if (testMode === 'B') {
        hasFinishedRef.current = true;
        clearTimers();
      }
    }
  };

  const handleStopSpeech = () => {
    addLog('Manual user click: recognition.stop() called');
    clearTimers();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        addLog(`Error during manual stop(): ${e}`);
      }
    }
  };

  const handleAbortSpeech = () => {
    addLog('Manual user click: recognition.abort() called');
    clearTimers();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        addLog(`Error during manual abort(): ${e}`);
      }
      recognitionRef.current = null;
    }
    setSpeechState('aborted');
  };

  const handleCopyLogs = async () => {
    const text = `=== INDEPENDENT SPEECH RECOGNITION COMPARISON TEST LOGS ===
Mode: ${testMode === 'A' ? 'Mode A (Natural Auto-End)' : 'Mode B (1.5s Silence Timer + Explicit stop())'}
Platform: ${navigator.userAgent}
Date: ${new Date().toISOString()}
Attempts: ${attemptCount}
State: ${speechState}
Transcript: "${transcript}"

Logs (${logs.length}):
` + logs.map((l) => `[${l.timestamp}] ${l.event}${l.details ? ' ' + l.details : ''}`).reverse().join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch (e) {}
    }

    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 font-mono max-w-lg mx-auto space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to App</span>
        </button>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-bold text-sm text-emerald-400">Speech Comparison Test</span>
        </div>
      </div>

      {/* Mode Selector Tabs (Mode A vs Mode B) */}
      <div className="bg-slate-800/90 p-1.5 rounded-xl border border-slate-700 grid grid-cols-2 gap-1 font-sans text-xs">
        <button
          onClick={() => { setTestMode('A'); addLog('Switched to Mode A'); }}
          className={`py-2 px-2 rounded-lg font-bold text-center transition-all cursor-pointer ${
            testMode === 'A'
              ? 'bg-sky-500 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div>Mode A: Natural Auto-End</div>
          <div className="text-[10px] font-normal opacity-80 mt-0.5">Current App (continuous=false)</div>
        </button>

        <button
          onClick={() => { setTestMode('B'); addLog('Switched to Mode B'); }}
          className={`py-2 px-2 rounded-lg font-bold text-center transition-all cursor-pointer ${
            testMode === 'B'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div>Mode B: Explicit stop()</div>
          <div className="text-[10px] font-normal opacity-80 mt-0.5">Previous App (1.5s Silence Timer)</div>
        </button>
      </div>

      {/* Description Box */}
      <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700 text-xs leading-relaxed space-y-1">
        <div className="font-bold text-amber-300 flex items-center gap-1 font-sans">
          <AlertCircle className="w-4 h-4" />
          <span>{testMode === 'A' ? 'Mode A: Natural Auto-End' : 'Mode B: Explicit stop() + 1.5s Timer'}</span>
        </div>
        <p className="text-slate-300 text-[11px] font-sans">
          {testMode === 'A'
            ? 'Runs continuous=false and waits for browser native onend. Observe if iPhone status bar Orange Mic dot stays ON.'
            : 'Runs continuous=true + interimResults=true. After 1.5s of silence, explicitly calls recognition.stop() with hasFinishedRef guard.'}
        </p>
      </div>

      {/* Status Card */}
      <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Active Mode:</span>
          <span className="font-bold text-sky-400 font-sans">Mode {testMode}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Total Attempts:</span>
          <span className="font-bold text-amber-400">#{attemptCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Speech State:</span>
          <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
            speechState === 'listening' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse' :
            speechState === 'ended' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-slate-700 text-slate-300'
          }`}>
            {speechState}
          </span>
        </div>
        <div className="pt-1 border-t border-slate-700/60 space-y-1">
          <div className="text-slate-400 text-[11px]">Captured Transcript:</div>
          <div className="p-2 bg-slate-900 rounded border border-slate-700 text-slate-200 text-xs font-sans italic min-h-[38px] break-words">
            {transcript ? `"${transcript}"` : <span className="text-slate-500">(No transcript captured yet)</span>}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <button
          onClick={handleStartSpeech}
          className={`py-3 px-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer ${
            testMode === 'A' ? 'bg-sky-600 hover:bg-sky-500' : 'bg-amber-600 hover:bg-amber-500 text-slate-950'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>Start Mode {testMode} Test</span>
        </button>
        <button
          onClick={handleAbortSpeech}
          className="py-3 px-3 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
        >
          <Square className="w-4 h-4" />
          <span>Abort ()</span>
        </button>
      </div>

      {/* Utility Actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          onClick={handleCopyLogs}
          className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied Test Logs!' : 'Copy Test Logs'}</span>
        </button>
        <button
          onClick={() => { setLogs([]); addLog('Logs cleared'); }}
          className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          title="Clear logs"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Real-time Event Log Stream */}
      <div className="space-y-1.5 pt-2 border-t border-slate-800">
        <div className="text-[11px] font-sans font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Event Log Stream - Mode {testMode} ({logs.length})</span>
          <span className="text-[10px] text-slate-500 font-normal">Newest first</span>
        </div>

        {logs.length === 0 ? (
          <div className="text-slate-500 text-xs italic py-4 text-center">
            Tap "Start Mode {testMode} Test" to test on iPhone Safari or Android.
          </div>
        ) : (
          <div className="space-y-1 font-mono text-[11px] max-h-[360px] overflow-y-auto pr-1">
            {logs.map((log) => (
              <div key={log.id} className="p-2 rounded bg-slate-800/60 border border-slate-700/60 flex items-start gap-2 leading-tight">
                <span className="text-slate-500 text-[10px] shrink-0">{log.timestamp}</span>
                <span className="text-slate-200 break-all">{log.event}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
