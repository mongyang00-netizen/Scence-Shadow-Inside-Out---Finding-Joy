export interface DiagnosticLog {
  id: number;
  timestamp: string;
  category: 'YT' | 'MIC' | 'REC' | 'SPEECH' | 'SESSION' | 'SYS';
  message: string;
  data?: any;
}

export interface DiagnosticState {
  attemptCounter: number;
  ytState: string;
  ytStateCode: number;
  ytTime: number;
  ytVolume: number;
  ytIsMuted: boolean;
  ytLoadedFraction: number;
  timeToStartPlayingMs: number | null;
  audioSessionSupported: boolean;
  audioSessionType: string;
  audioSessionState: string;
  recState: string;
  recMime: string;
  trackLabel: string;
  trackMuted: boolean;
  trackReadyState: string;
  trackEnabled: boolean;
  trackSettingsSummary: string;
  chunksCount: number;
  totalBytes: number;
  speechState: string;
  lastBlobHex: string;
  lastBlobAscii: string;
  lastBlobSize: number | null;
  lastBlobMime: string;
  lastChunkSizes: string;
  lastRecordingDurationMs: number | null;
  audioElementStatus: string;
  lateCallbacksCount: number;
}

type DiagnosticListener = (logs: DiagnosticLog[], state: DiagnosticState) => void;

class AudioDiagnosticsManager {
  private isEnabled: boolean = false;
  private logs: DiagnosticLog[] = [];
  private listeners: Set<DiagnosticListener> = new Set();
  private nextLogId: number = 1;
  private attemptCounter: number = 0;

  private currentState: DiagnosticState = {
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
    trackSettingsSummary: 'N/A',
    chunksCount: 0,
    totalBytes: 0,
    speechState: 'idle',
    lastBlobHex: '',
    lastBlobAscii: '',
    lastBlobSize: null,
    lastBlobMime: '',
    lastChunkSizes: '[]',
    lastRecordingDurationMs: null,
    audioElementStatus: 'none',
    lateCallbacksCount: 0
  };

  constructor() {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      this.isEnabled = search.includes('debugAudio=1') || search.includes('debugAudio=true');
      if (this.isEnabled) {
        this.log('SYS', 'Audio Diagnostics initialized via ?debugAudio=1');
        this.checkAudioSession();
      }
    }
  }

  public incrementAttempt(): number {
    this.attemptCounter += 1;
    this.updateState({ attemptCounter: this.attemptCounter });
    return this.attemptCounter;
  }

  public getAttempt(): number {
    return this.attemptCounter;
  }

  public checkAudioSession() {
    if (typeof navigator !== 'undefined' && (navigator as any).audioSession) {
      const session = (navigator as any).audioSession;
      this.currentState.audioSessionSupported = true;
      this.currentState.audioSessionType = session.type || 'unknown';
      this.currentState.audioSessionState = session.state || 'unknown';
      this.log('SESSION', `navigator.audioSession found: type=${session.type || 'N/A'}, state=${session.state || 'N/A'}`);
    } else {
      this.currentState.audioSessionSupported = false;
      this.currentState.audioSessionType = 'Unsupported on this browser';
      this.currentState.audioSessionState = 'N/A';
    }
  }

  public log(category: 'YT' | 'MIC' | 'REC' | 'SPEECH' | 'SESSION' | 'SYS', message: string, data?: any) {
    if (!this.isEnabled) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const entry: DiagnosticLog = {
      id: this.nextLogId++,
      timestamp: timeStr,
      category,
      message,
      data
    };
    this.logs.unshift(entry);
    if (this.logs.length > 200) this.logs.pop();
    this.notify();
  }

  public updateState(partial: Partial<DiagnosticState>) {
    if (!this.isEnabled) return;
    this.currentState = { ...this.currentState, ...partial };
    this.notify();
  }

  public clearLogs() {
    this.logs = [];
    this.notify();
  }

  public async copyLogsToClipboard(): Promise<boolean> {
    const text = this.getFormattedLogsText();
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('Clipboard writeText failed:', err);
      }
    }

    // Fallback: create temporary textarea for selection copy (essential on iOS Safari inside iframe)
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    } catch (err) {
      console.error('Fallback copy failed:', err);
      return false;
    }
  }

  public async inspectBlob(blob: Blob): Promise<{ hex: string; ascii: string; size: number; mime: string; signatureNote: string }> {
    try {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const sliceLen = Math.min(bytes.length, 32);
      const hexArr: string[] = [];
      const asciiArr: string[] = [];
      for (let i = 0; i < sliceLen; i++) {
        const b = bytes[i];
        hexArr.push(b.toString(16).padStart(2, '0').toUpperCase());
        asciiArr.push(b >= 32 && b <= 126 ? String.fromCharCode(b) : '.');
      }
      const hex = hexArr.join(' ');
      const ascii = asciiArr.join('');

      let signatureNote = 'Unknown audio/container format';
      if (hex.startsWith('1A 45 DF A3')) {
        signatureNote = 'EBML Header (WebM/Matroska container)';
      } else if (ascii.includes('ftyp') || hex.includes('66 74 79 70')) {
        signatureNote = 'ISO Base Media File Format (MP4 / ftyp box)';
      } else if (hex.startsWith('52 49 46 46')) {
        signatureNote = 'RIFF Header (WAV format)';
      } else if (hex.startsWith('FF F1') || hex.startsWith('FF F9')) {
        signatureNote = 'AAC ADTS syncword';
      } else if (blob.size <= 10) {
        signatureNote = `Tiny fragment (${blob.size} bytes - likely incomplete header or empty flush)`;
      }

      return { hex, ascii, size: blob.size, mime: blob.type || 'unknown', signatureNote };
    } catch (e: any) {
      return {
        hex: 'ERROR_READING_BYTES',
        ascii: '',
        size: blob.size,
        mime: blob.type || 'unknown',
        signatureNote: `Read error: ${e?.message || e}`
      };
    }
  }

  public getFormattedLogsText(): string {
    const stateSummary = `=== AUDIO DIAGNOSTICS LOG SUMMARY ===
Timestamp: ${new Date().toISOString()}
Attempts Total: ${this.currentState.attemptCounter}
YT State: ${this.currentState.ytState} (${this.currentState.ytStateCode}) | Time: ${this.currentState.ytTime.toFixed(2)}s | Vol: ${this.currentState.ytVolume}% | Muted: ${this.currentState.ytIsMuted} | Loaded: ${(this.currentState.ytLoadedFraction * 100).toFixed(1)}% | Play Latency: ${this.currentState.timeToStartPlayingMs ?? 'N/A'}ms
Recorder State: ${this.currentState.recState} | Track Muted: ${this.currentState.trackMuted} | Track State: ${this.currentState.trackReadyState} | Label: "${this.currentState.trackLabel}"
Track Settings: ${this.currentState.trackSettingsSummary}
Last Recorded Blob: ${this.currentState.lastBlobSize !== null ? `${this.currentState.lastBlobSize} B (${this.currentState.lastBlobMime})` : 'None'}
Last Blob Hex: [${this.currentState.lastBlobHex || 'N/A'}]
Last Blob ASCII: "${this.currentState.lastBlobAscii || 'N/A'}"
Recorded Chunks: ${this.currentState.totalBytes} B in ${this.currentState.chunksCount} chunks | Sizes: ${this.currentState.lastChunkSizes}
Last Rec Duration: ${this.currentState.lastRecordingDurationMs !== null ? `${this.currentState.lastRecordingDurationMs}ms` : 'N/A'}
AudioElement Status: ${this.currentState.audioElementStatus}
Late Callbacks / Session Mismatches: ${this.currentState.lateCallbacksCount}
Speech Recognition State: ${this.currentState.speechState}
AudioSession: ${this.currentState.audioSessionType} (${this.currentState.audioSessionState})

=== EVENT LOGS (${this.logs.length}) ===
` + this.logs.map(l => `[${l.timestamp}] [${l.category}] ${l.message}${l.data ? ' ' + JSON.stringify(l.data) : ''}`).reverse().join('\n');
    return stateSummary;
  }

  public subscribe(fn: DiagnosticListener) {
    this.listeners.add(fn);
    fn([...this.logs], { ...this.currentState });
    return () => {
      this.listeners.delete(fn);
    };
  }

  public checkEnabled(): boolean {
    return this.isEnabled;
  }

  private notify() {
    this.listeners.forEach((fn) => fn([...this.logs], { ...this.currentState }));
  }
}

export const audioDiagnostics = new AudioDiagnosticsManager();
