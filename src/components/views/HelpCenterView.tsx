import { BookCheck, Bot, CalendarDays, Clock, HelpCircle, Inbox, Megaphone, MessageSquare, Search, UserCircle, Wallet } from 'lucide-react';
import type { ClassSettings, NavTab, UserRole } from '../../types';
import { canUseC6ABot } from '../../utils/c6aBot';
import { CrestLogo } from '../CrestLogo';

interface HelpCenterViewProps {
  settings: ClassSettings;
  role?: UserRole;
  onNavigate: (tab: NavTab) => void;
}

const MENU_GUIDES = [
  {
    tab: 'jadwal' as NavTab,
    title: 'Jadwal Pelajaran 6 Hari',
    icon: Clock,
    desc: 'Menampilkan daftar mata pelajaran Senin hingga Sabtu beserta nomor urut, jam pelajaran (atau status "Belum diatur"), serta penanda pelajaran berikutnya.',
  },
  {
    tab: 'tugas' as NavTab,
    title: 'Tugas Sekolah',
    icon: BookCheck,
    desc: 'Semua siswa dapat menambahkan tugas baru, memfilter berdasarkan mata pelajaran atau status (Belum, Sedang, Selesai, Terlambat), serta menandai progres pengerjaan pribadi.',
  },
  {
    tab: 'pengumuman' as NavTab,
    title: 'Pengumuman Kelas',
    icon: Megaphone,
    desc: 'Pengumuman resmi yang dipublikasikan oleh Owner atau Admin. Pengumuman penting dapat disematkan di atas dan memicu notifikasi real-time.',
  },
  {
    tab: 'agenda' as NavTab,
    title: 'Agenda & Kalender Kelas',
    icon: CalendarDays,
    desc: 'Siswa dapat mengusulkan agenda kegiatan kelas, memantau agenda mendatang/selesai, dan melihat kalender bulanan kegiatan.',
  },
  {
    tab: 'kas' as NavTab,
    title: 'Catatan Uang Kas',
    icon: Wallet,
    desc: 'Transparansi saldo kas, pemasukan, pengeluaran, rekap bulanan, serta riwayat transaksi kelas yang dikelola oleh Owner/Admin.',
  },
  {
    tab: 'chat' as NavTab,
    title: 'Chat Kelas & Pesan Admin',
    icon: MessageSquare,
    desc: 'Gunakan Chat Kelas untuk diskusi bersama (ketik /jadwal atau @C6A untuk panggil asisten), dan Pesan untuk Admin guna mengirim izin atau pertanyaan pribadi.',
  },
  {
    tab: 'c6a-ai' as NavTab,
    title: 'Bot & AI C6A',
    icon: Bot,
    desc: 'Asisten pintar Kelas 6A: gunakan perintah cepat (/menu, /jadwal, /tugas, /pengumuman, /agenda, /kas) atau tanya C6A AI seputar materi pelajaran kelas 6.',
  },
];

export function HelpCenterView({ settings, role, onNavigate }: HelpCenterViewProps) {
  const botAllowed = canUseC6ABot(role);
  const guides = MENU_GUIDES.map((g) => {
    if (g.tab === 'chat' && !botAllowed) {
      return {
        ...g,
        desc: 'Gunakan Chat Kelas untuk diskusi bersama (ketik @C6A untuk tanya C6A AI), dan Pesan untuk Admin guna mengirim izin atau pertanyaan pribadi.',
      };
    }
    if (g.tab === 'c6a-ai' && !botAllowed) {
      return {
        ...g,
        title: 'C6A AI',
        desc: 'Asisten AI belajar untuk seluruh siswa Kelas 6A: tanyakan informasi jadwal, tugas, agenda kelas, atau materi pelajaran kelas 6.',
      };
    }
    return g;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B2416] flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#0B6B3A]" />
            <span>Pusat Bantuan Portal Kelas 6A</span>
          </h2>
          <p className="text-sm text-[#52705E]">
            Panduan lengkap penggunaan fitur portal digital Kelas 6A MI Al-Hidayah Sawotratap.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <CrestLogo size="md" variant="kelas6a" />
          <CrestLogo size="md" variant="school" />
        </div>
      </div>

      {/* Menu Explanations */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {guides.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => onNavigate(item.tab)}
              className="text-left bg-white hover:bg-[#F7FBF8] border border-[#D3E6D8] rounded-2xl p-5 space-y-2.5 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 text-[#0B6B3A] font-semibold text-sm">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-[#0B2416]">{item.title}</span>
              </div>
              <p className="text-xs text-[#2F4F3C] leading-relaxed">{item.desc}</p>
            </button>
          );
        })}
      </section>

      {/* Step-by-step Quick Guides */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-semibold text-[#0B2416]">Panduan Langkah Cepat</h3>
          <div className="space-y-3 text-sm text-[#2F4F3C]">
            <div>
              <p className="font-semibold text-[#0B6B3A] text-xs">1. Cara Menambahkan Tugas Sekolah</p>
              <p className="text-xs text-[#2F4F3C] mt-0.5 leading-relaxed">
                Buka menu <strong>Tugas Sekolah</strong> → klik tombol <strong>Tambah Tugas</strong> → isi mata pelajaran, judul, prioritas, tanggal diberikan, dan tenggat → klik <strong>Simpan Tugas</strong>.
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#0B6B3A] text-xs">2. Cara Melihat Jadwal Pelajaran</p>
              <p className="text-xs text-[#2F4F3C] mt-0.5 leading-relaxed">
                Buka menu <strong>Jadwal Pelajaran</strong> untuk memilih hari Senin–Sabtu atau melihat seluruh kartu enam hari. Jam bertuliskan &ldquo;Belum diatur&rdquo; menandakan jam belum ditetapkan oleh Owner.
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#0B6B3A] text-xs">3. Cara Mengirim Pesan ke Admin / Wali Kelas</p>
              <p className="text-xs text-[#2F4F3C] mt-0.5 leading-relaxed">
                Buka menu <strong>Pesan untuk Admin</strong> → pilih kategori (Izin, Laporan, Saran, Pertanyaan) → tulis subjek &amp; isi pesan → kirim. Balasan Admin hanya terlihat oleh Anda.
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#0B6B3A] text-xs">4. Cara Mengubah Profil &amp; Nama Panggilan</p>
              <p className="text-xs text-[#2F4F3C] mt-0.5 leading-relaxed">
                Buka menu <strong>Profil Saya</strong> → ubah nama panggilan tampilan atau nomor absen → klik <strong>Simpan Profil</strong>.
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#0B6B3A] text-xs">
                5. Cara Menggunakan {botAllowed ? 'Bot & AI C6A' : 'C6A AI'}
              </p>
              <p className="text-xs text-[#2F4F3C] mt-0.5 leading-relaxed">
                {botAllowed ? (
                  <>
                    Buka menu <strong>Bot &amp; AI C6A</strong> untuk memakai perintah cepat Bot (<code className="text-[#0B6B3A] font-semibold">/jadwal</code>, <code className="text-[#0B6B3A] font-semibold">/tugas</code>, <code className="text-[#0B6B3A] font-semibold">/kas</code>) khusus Admin/Owner atau bertanya ke C6A AI. Di <strong>Chat Kelas</strong>, ketik awalan <code className="text-[#0B6B3A] font-semibold">/</code> atau <code className="text-[#0B6B3A] font-semibold">@C6A</code>.
                  </>
                ) : (
                  <>
                    Buka menu <strong>C6A AI</strong> untuk menanyakan materi pelajaran atau ringkasan jadwal dan tugas Kelas 6A. Di <strong>Chat Kelas</strong>, ketik <code className="text-[#0B6B3A] font-semibold">@C6A &lt;pertanyaan&gt;</code> untuk memanggil C6A AI. (Perintah Bot <code className="text-[#0B6B3A] font-semibold">/...</code> khusus Admin &amp; Owner.)
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-[#0B2416]">Informasi &amp; Kontak Pengurus</h3>
            <p className="text-xs text-[#2F4F3C] leading-relaxed">
              <strong>Wali Kelas:</strong> {settings.homeroomTeacher}
            </p>
            <p className="text-xs text-[#2F4F3C] leading-relaxed">
              <strong>Tahun Ajaran:</strong> {settings.academicYear}
            </p>
            <p className="text-xs text-[#2F4F3C] leading-relaxed">
              <strong>Kontak &amp; Layanan:</strong> {settings.adminContactNote}
            </p>
            <p className="text-xs text-[#52705E] leading-relaxed">
              Tip: Gunakan tombol <strong>Cari</strong> di header atas untuk menemukan tugas, pengumuman, jadwal, atau agenda dengan cepat.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('pesan-admin')}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Inbox className="w-4 h-4" />
              <span>Kirim Pesan Admin</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('profil')}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#F0F7F2] hover:bg-[#E2EFE6] border border-[#C6E0CE] text-[#0B2416] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <UserCircle className="w-4 h-4 text-[#0B6B3A]" />
              <span>Buka Profil</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('beranda')}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#F0F7F2] hover:bg-[#E2EFE6] border border-[#C6E0CE] text-[#0B2416] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Search className="w-4 h-4 text-[#0B6B3A]" />
              <span>Kembali ke Beranda</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
