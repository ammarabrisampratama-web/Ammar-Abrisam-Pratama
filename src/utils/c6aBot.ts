import type {
  AgendaItem,
  Announcement,
  Assignment,
  ClassSettings,
  DayOfWeek,
  ScheduleItem,
  TaskProgressStatus,
  TreasuryEntry,
  UserRole,
} from '../types';
import {
  calculateTreasurySummary,
  DAYS_ORDER,
  deriveTaskStatus,
  formatRupiah,
  formatScheduleTimeRange,
  getJakartaDateString,
  getTodayIndonesianDay,
  isSundayJakarta,
  sortSchedulesForDay,
} from './validation';

export interface C6AClassContextData {
  settings: ClassSettings;
  schedules: ScheduleItem[];
  assignments: Assignment[];
  taskProgressMap: Map<string, TaskProgressStatus>;
  announcements: Announcement[];
  agendas: AgendaItem[];
  treasury: TreasuryEntry[];
  now?: Date;
}

export interface C6ABotCommandResult {
  handled: boolean;
  command?: string;
  reply: string;
}

export function canUseC6ABot(role: UserRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canUseC6AAI(role: UserRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'siswa';
}

function normalizeDayArg(arg: string): DayOfWeek | null {
  const lower = arg.trim().toLowerCase();
  if (!lower) return null;
  if (lower.startsWith('sen')) return 'Senin';
  if (lower.startsWith('sel')) return 'Selasa';
  if (lower.startsWith('rab')) return 'Rabu';
  if (lower.startsWith('kam')) return 'Kamis';
  if (lower.startsWith('jum')) return 'Jumat';
  if (lower.startsWith('sab')) return 'Sabtu';
  return null;
}

export function runC6ABotCommand(
  rawInput: string,
  ctx: C6AClassContextData,
  role?: UserRole | null
): C6ABotCommandResult {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith('/')) {
    return { handled: false, reply: '' };
  }

  if (role && !canUseC6ABot(role)) {
    return {
      handled: true,
      command: trimmed.split(/\s+/)[0].toLowerCase(),
      reply:
        'Perintah Bot C6A (/...) hanya dapat digunakan oleh Admin dan Owner. Anda tetap dapat menggunakan C6A AI dengan menulis pertanyaan langsung.',
    };
  }

  const [cmdRaw, ...rest] = trimmed.split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const arg = rest.join(' ').trim();
  const now = ctx.now ?? new Date();
  const todayStr = getJakartaDateString(now);

  if (cmd === '/help' || cmd === '/menu' || cmd === '/bantuan') {
    return {
      handled: true,
      command: cmd,
      reply: [
        'Bot C6A siap membantu! Daftar perintah cepat:',
        '• /jadwal — Jadwal pelajaran hari ini (atau ketik /jadwal Senin .. Sabtu)',
        '• /tugas — Daftar tugas sekolah yang belum selesai',
        '• /pengumuman — Pengumuman aktif terbaru kelas 6A',
        '• /agenda — Agenda kegiatan kelas mendatang',
        '• /kas — Ringkasan saldo & transaksi uang kas',
        'Atau ketik pertanyaan bebas apa saja untuk dijawab oleh C6A AI!',
      ].join('\n'),
    };
  }

  if (cmd === '/jadwal') {
    if (arg.toLowerCase() === 'semua' || arg.toLowerCase() === 'lengkap') {
      const lines = DAYS_ORDER.map((day) => {
        const list = sortSchedulesForDay(ctx.schedules, day);
        const mapel = list.map((s) => `${s.order}. ${s.subject}`).join(', ') || 'Belum ada';
        return `${day}: ${mapel}`;
      });
      return {
        handled: true,
        command: cmd,
        reply: `Jadwal Lengkap 6 Hari Kelas 6A:\n${lines.join('\n')}`,
      };
    }

    const explicitDay = normalizeDayArg(arg);
    if (!explicitDay && isSundayJakarta(now)) {
      return {
        handled: true,
        command: cmd,
        reply:
          'Hari ini hari Minggu (libur sekolah). Ketik /jadwal Senin atau /jadwal lengkap untuk melihat jadwal belajar.',
      };
    }

    const targetDay = explicitDay ?? getTodayIndonesianDay(now);
    const list = sortSchedulesForDay(ctx.schedules, targetDay);
    if (list.length === 0) {
      return {
        handled: true,
        command: cmd,
        reply: `Belum ada jadwal tercatat untuk hari ${targetDay}.`,
      };
    }
    const rows = list.map(
      (s) => `${s.order}. ${s.subject} (${formatScheduleTimeRange(s.startTime, s.endTime)})`
    );
    return {
      handled: true,
      command: cmd,
      reply: `Jadwal Pelajaran Hari ${targetDay}:\n${rows.join('\n')}`,
    };
  }

  if (cmd === '/tugas') {
    const active = ctx.assignments
      .filter((a) => deriveTaskStatus(a.dueDate, ctx.taskProgressMap.get(a.id), todayStr) !== 'selesai')
      .slice()
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (active.length === 0) {
      return {
        handled: true,
        command: cmd,
        reply: 'Hebat! Tidak ada tugas sekolah aktif yang belum selesai saat ini.',
      };
    }

    const rows = active.slice(0, 8).map((t, idx) => {
      const st = deriveTaskStatus(t.dueDate, ctx.taskProgressMap.get(t.id), todayStr);
      const label = st === 'terlambat' ? 'TERLAMBAT' : st === 'sedang' ? 'Sedang dikerjakan' : 'Belum';
      return `${idx + 1}. [${t.subject}] ${t.title} · Tenggat ${t.dueDate} (${label})`;
    });
    return {
      handled: true,
      command: cmd,
      reply: `Daftar Tugas Aktif (${active.length}):\n${rows.join('\n')}`,
    };
  }

  if (cmd === '/pengumuman') {
    const active = ctx.announcements
      .filter((a) => !a.archived)
      .slice()
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));

    if (active.length === 0) {
      return {
        handled: true,
        command: cmd,
        reply: 'Belum ada pengumuman aktif di Kelas 6A.',
      };
    }

    const rows = active.slice(0, 5).map((a, idx) => {
      const pinTag = a.pinned ? '[Disematkan] ' : '';
      return `${idx + 1}. ${pinTag}${a.title} (${a.category})\n   ${a.content.slice(0, 120)}`;
    });
    return {
      handled: true,
      command: cmd,
      reply: `Pengumuman Terbaru Kelas 6A:\n${rows.join('\n')}`,
    };
  }

  if (cmd === '/agenda') {
    const upcoming = ctx.agendas
      .filter((a) => a.status === 'mendatang')
      .slice()
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

    if (upcoming.length === 0) {
      return {
        handled: true,
        command: cmd,
        reply: 'Belum ada agenda kegiatan mendatang.',
      };
    }

    const rows = upcoming.slice(0, 6).map(
      (ag, idx) =>
        `${idx + 1}. ${ag.title} · ${ag.eventDate}${ag.eventTime ? ` ${ag.eventTime} WIB` : ''} (${ag.location})`
    );
    return {
      handled: true,
      command: cmd,
      reply: `Agenda Kelas Mendatang:\n${rows.join('\n')}`,
    };
  }

  if (cmd === '/kas') {
    const summary = calculateTreasurySummary(ctx.treasury);
    return {
      handled: true,
      command: cmd,
      reply: [
        'Ringkasan Uang Kas Kelas 6A:',
        `• Saldo Tersedia: ${formatRupiah(summary.balance)}`,
        `• Total Pemasukan: ${formatRupiah(summary.totalIncome)}`,
        `• Total Pengeluaran: ${formatRupiah(summary.totalExpense)}`,
        `• Target Kas Mingguan: ${formatRupiah(ctx.settings.weeklyKasTarget)}`,
      ].join('\n'),
    };
  }

  return {
    handled: true,
    command: cmd,
    reply: `Perintah "${cmd}" tidak dikenali. Ketik /menu untuk melihat perintah Bot C6A, atau kirim pertanyaan tanpa garis miring (/) untuk bertanya ke C6A AI.`,
  };
}

export function extractChatBotQuery(
  chatText: string,
  role: UserRole | null = 'owner'
): { isBotTrigger: boolean; mode: 'bot' | 'ai' | null; queryText: string } {
  const trimmed = chatText.trim();
  if (trimmed.startsWith('/')) {
    if (!canUseC6ABot(role)) {
      return { isBotTrigger: false, mode: null, queryText: '' };
    }
    return { isBotTrigger: true, mode: 'bot', queryText: trimmed };
  }
  const mentionMatch = trimmed.match(/^@c6a\b[\s,:-]*(.*)$/i);
  if (mentionMatch) {
    const question = (mentionMatch[1] || '').trim();
    if (!question) {
      if (canUseC6ABot(role)) {
        return { isBotTrigger: true, mode: 'bot', queryText: '/menu' };
      }
      return {
        isBotTrigger: true,
        mode: 'ai',
        queryText: 'Halo C6A, bantu saya melihat ringkasan jadwal dan tugas kelas 6A hari ini.',
      };
    }
    if (question.startsWith('/') && canUseC6ABot(role)) {
      return { isBotTrigger: true, mode: 'bot', queryText: question };
    }
    return {
      isBotTrigger: true,
      mode: 'ai',
      queryText: question,
    };
  }
  return { isBotTrigger: false, mode: null, queryText: '' };
}

export function buildSanitizedC6AContextSummary(ctx: C6AClassContextData): string {
  const now = ctx.now ?? new Date();
  const todayStr = getJakartaDateString(now);
  const todayDay = isSundayJakarta(now) ? 'Minggu (Libur)' : getTodayIndonesianDay(now);

  const scheduleLines = DAYS_ORDER.map((day) => {
    const list = sortSchedulesForDay(ctx.schedules, day);
    return `${day}: ${list.map((s) => `${s.order}. ${s.subject} (${formatScheduleTimeRange(s.startTime, s.endTime)})`).join(', ')}`;
  }).join('\n');

  const activeTasks = ctx.assignments
    .filter((a) => deriveTaskStatus(a.dueDate, ctx.taskProgressMap.get(a.id), todayStr) !== 'selesai')
    .slice(0, 8)
    .map((t) => `- [${t.subject}] ${t.title} (Tenggat: ${t.dueDate}, Prioritas: ${t.priority})`)
    .join('\n');

  const activeAnn = ctx.announcements
    .filter((a) => !a.archived)
    .slice(0, 5)
    .map((a) => `- ${a.title} [${a.category}]: ${a.content.slice(0, 120)}`)
    .join('\n');

  const upcomingAgendas = ctx.agendas
    .filter((a) => a.status === 'mendatang')
    .slice(0, 5)
    .map((ag) => `- ${ag.title} (${ag.eventDate} di ${ag.location})`)
    .join('\n');

  const summary = calculateTreasurySummary(ctx.treasury);

  return [
    `Tanggal hari ini: ${todayStr} (${todayDay}, WIB).`,
    `Wali Kelas: ${ctx.settings.homeroomTeacher}, Tahun Ajaran: ${ctx.settings.academicYear}.`,
    `Jadwal 6 Hari:\n${scheduleLines}`,
    `Tugas Belum Selesai:\n${activeTasks || '- Tidak ada tugas aktif'}`,
    `Pengumuman Aktif:\n${activeAnn || '- Tidak ada pengumuman aktif'}`,
    `Agenda Mendatang:\n${upcomingAgendas || '- Tidak ada agenda mendatang'}`,
    `Kas Kelas: Saldo ${formatRupiah(summary.balance)} (Pemasukan ${formatRupiah(summary.totalIncome)}, Pengeluaran ${formatRupiah(summary.totalExpense)}).`,
  ].join('\n\n');
}
