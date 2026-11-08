export interface DiagnosticLog {
  id: number;
  timestamp: string;
  category: 'YT' | 'MIC' | 'REC' | 'SESSION' | 'SYS';
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
  chunksCount: number;
  totalBytes: number;
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
    chunksCount: 0,
    totalBytes: 0,
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

  public log(category: 'YT' | 'MIC' | 'REC' | 'SESSION' | 'SYS', message: string, data?: any) {
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

  public getFormattedLogsText(): string {
    const stateSummary = `=== AUDIO DIAGNOSTICS LOG SUMMARY ===
Timestamp: ${new Date().toISOString()}
Attempts Total: ${this.currentState.attemptCounter}
YT State: ${this.currentState.ytState} (${this.currentState.ytStateCode}) | Time: ${this.currentState.ytTime.toFixed(2)}s | Vol: ${this.currentState.ytVolume}% | Muted: ${this.currentState.ytIsMuted} | Loaded: ${(this.currentState.ytLoadedFraction * 100).toFixed(1)}% | Play Latency: ${this.currentState.timeToStartPlayingMs ?? 'N/A'}ms
Recorder State: ${this.currentState.recState} | Track Muted: ${this.currentState.trackMuted} | Track State: ${this.currentState.trackReadyState} | Label: "${this.currentState.trackLabel}"
Recorded Bytes: ${this.currentState.totalBytes} B (${this.currentState.chunksCount} chunks)
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
