import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Terjadi gangguan saat memuat data kelas.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Uncaught application error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'Terjadi kendala saat menghubungkan ke server kelas.';
      if (this.state.message.includes('Missing or insufficient permissions') || this.state.message.includes('permission-denied')) {
        friendly = 'Akses ditolak oleh aturan keamanan Firestore. Pastikan akun Anda telah terverifikasi dan memiliki hak akses yang sesuai.';
      }
      return (
        <div className="min-h-screen bg-[#F4F9F5] text-[#0B2416] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#D3E6D8] rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 text-amber-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-semibold text-[#0B2416]">Kendala Aplikasi</h1>
            </div>
            <p className="text-sm text-[#2F4F3C] leading-relaxed">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Muat Ulang Halaman</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
