import React from 'react';
import { AlertTriangle, Check, Copy, RefreshCw, RotateCcw } from 'lucide-react';
import { classifyApplicationError, detectBrowserEnvironment } from '../utils/resilience';

interface State {
  hasError: boolean;
  error: unknown;
  message: string;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, message: '', copied: false };
  }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    const message =
      error instanceof Error
        ? error.message || error.name
        : typeof error === 'string'
          ? error
          : 'Terjadi gangguan saat memuat data kelas.';
    return {
      hasError: true,
      error,
      message,
      copied: false,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Uncaught application error:', error, info);
  }

  private handleResetBoundary = () => {
    this.setState({ hasError: false, error: null, message: '', copied: false });
  };

  private handleForceReload = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_r', String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  private handleCopyDiagnostics = async (detailText: string) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(detailText);
        this.setState({ copied: true });
        window.setTimeout(() => this.setState({ copied: false }), 2500);
      }
    } catch {
      // Ignore clipboard restriction on older Android WebView
    }
  };

  render() {
    if (this.state.hasError) {
      const classified = classifyApplicationError(this.state.error ?? this.state.message);
      const env = detectBrowserEnvironment();
      const shortRaw = (this.state.message || 'Unknown error').slice(0, 280);
      const diagnosticSummary = [
        `Kategori: ${classified.code}`,
        `Perangkat: ${env.isAndroid ? 'Android' : env.isIOS ? 'iOS' : 'Desktop'}`,
        `WebView: ${env.isInAppWebView ? env.inAppAppName || 'Ya' : 'Tidak'}`,
        `Storage: local=${env.localStorageAvailable}, session=${env.sessionStorageAvailable}`,
        `Online: ${env.isOnline}`,
        `Pesan: ${shortRaw}`,
      ].join('\n');

      return (
        <div className="min-h-screen bg-[#F4F9F5] text-[#0B2416] flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-lg w-full bg-white border border-[#D3E6D8] rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                  {classified.code}
                </p>
                <h1 className="text-lg font-bold text-[#0B2416]">{classified.title}</h1>
              </div>
            </div>

            <div className="space-y-2 text-sm text-[#2F4F3C] leading-relaxed">
              <p>{classified.message}</p>
              <p className="text-xs bg-[#F0F7F2] border border-[#D3E6D8] rounded-xl p-3 text-[#2F4F3C]">
                <strong className="text-[#0B2416]">Saran perbaikan:</strong> {classified.hint}
              </p>
            </div>

            {env.isInAppWebView && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                Anda membuka portal dari <strong>{env.inAppAppName}</strong>. Ketuk menu titik tiga (⋮) di pojok layar lalu pilih <strong>Buka di Chrome / Browser Eksternal</strong> agar login &amp; penyimpanan berjalan normal.
              </div>
            )}

            <details className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3">
              <summary className="cursor-pointer font-semibold text-slate-700">
                Lihat detail teknis ({shortRaw.slice(0, 64)}{shortRaw.length > 64 ? '…' : ''})
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-slate-600">
                {diagnosticSummary}
              </pre>
            </details>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleResetBoundary}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Coba Lagi</span>
              </button>
              <button
                type="button"
                onClick={this.handleForceReload}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F0F7F2] hover:bg-[#E2EFE6] border border-[#C6E0CE] text-[#0B2416] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Muat Ulang Paksa</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => void this.handleCopyDiagnostics(diagnosticSummary)}
              className="w-full min-h-[38px] px-3 py-2 rounded-xl border border-[#D3E6D8] hover:bg-[#F8FCF9] text-xs font-medium text-[#52705E] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {this.state.copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#0B6B3A]" />
                  <span className="text-[#0B6B3A]">Detail error disalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Detail Error untuk Pengurus / Owner</span>
                </>
              )}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
