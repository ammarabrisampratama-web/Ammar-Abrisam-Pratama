import type {
  AdminMessage,
  AgendaItem,
  Announcement,
  Assignment,
  ClassSettings,
  DayOfWeek,
  ScheduleItem,
  TaskProgressStatus,
  TreasuryEntry,
  UserPublic,
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
  members?: UserPublic[];
  adminMessages?: AdminMessage[];
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
        'Perintah Bot C6A v1 (/...) hanya dapat digunakan oleh Admin dan Owner. Anda tetap dapat menggunakan C6A AI v1 dengan menulis pertanyaan langsung.',
    };
  }

  const [cmdRaw, ...rest] = trimmed.split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const arg = rest.join(' ').trim();
  const argLower = arg.toLowerCase();
  const now = ctx.now ?? new Date();
  const todayStr = getJakartaDateString(now);

  if (cmd === '/help' || cmd === '/menu' || cmd === '/bantuan') {
    return {
      handled: true,
      command: cmd,
      reply: [
        'Bot C6A v1 siap membantu! Daftar perintah cepat (Admin/Owner):',
        '• /rekap — Ringkasan eksekutif kelas hari ini (jadwal, tugas, kas, pesan)',
        '• /jadwal — Jadwal hari ini | /jadwal besok | /jadwal lengkap | /jadwal Senin..Sabtu',
        '• /tugas — Tugas aktif | /tugas terlambat | /tugas penting | /tugas <mapel>',
        '• /pengumuman — Pengumuman aktif | /pengumuman penting',
        '• /agenda — Agenda kegiatan kelas mendatang',
        '• /kas — Saldo kas | /kas terbaru | /kas pemasukan | /kas pengeluaran',
        '• /anggota — Daftar ringkas akun siswa & pengurus aktif',
        '• /pesan — Cek pesan siswa yang menunggu balasan Admin',
        'Atau ketik pertanyaan bebas tanpa (/) untuk bertanya ke C6A AI v1!',
      ].join('\n'),
    };
  }

  if (cmd === '/rekap' || cmd === '/ringkasan') {
    const dayLabel = isSundayJakarta(now) ? 'Minggu (Libur)' : getTodayIndonesianDay(now);
    const todayLessons = isSundayJakarta(now)
      ? []
      : sortSchedulesForDay(ctx.schedules, getTodayIndonesianDay(now));
    const activeTasks = ctx.assignments.filter(
      (a) => deriveTaskStatus(a.dueDate, ctx.taskProgressMap.get(a.id), todayStr) !== 'selesai'
    );
    const overdueCount = activeTasks.filter(
      (a) => deriveTaskStatus(a.dueDate, ctx.taskProgressMap.get(a.id), todayStr) === 'terlambat'
    ).length;
    const pinnedAnn = ctx.announcements.filter((a) => !a.archived && a.pinned);
    const upcomingAgenda = ctx.agendas
      .filter((a) => a.status === 'mendatang')
      .slice()
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];
    const summary = calculateTreasurySummary(ctx.treasury);
    const pendingMsgs = (ctx.adminMessages ?? []).filter((m) => m.status === 'menunggu').length;
    const activeMembers = (ctx.members ?? []).filter((m) => m.status === 'aktif').length;

    return {
      handled: true,
      command: cmd,
      reply: [
        `Rekap Harian Bot C6A v1 (${todayStr} · ${dayLabel}):`,
        `• Jadwal Hari Ini: ${
          todayLessons.length > 0
            ? todayLessons.map((s) => s.subject).join(', ')
            : 'Libur / belum ada jadwal'
        }`,
        `• Tugas Aktif: ${activeTasks.length} tugas (${overdueCount} terlambat)`,
        `• Pengumuman Disematkan: ${pinnedAnn.length > 0 ? pinnedAnn[0].title : 'Tidak ada'}`,
        `• Agenda Terdekat: ${
          upcomingAgenda ? `${upcomingAgenda.title} (${upcomingAgenda.eventDate})` : 'Belum ada'
        }`,
        `• Saldo Kas Kelas: ${formatRupiah(summary.balance)}`,
        `• Pesan Menunggu Balasan: ${pendingMsgs} pesan`,
        ...(ctx.members ? [`• Anggota Aktif Terdaftar: ${activeMembers} akun`] : []),
      ].join('\n'),
    };
  }

  if (cmd === '/jadwal') {
    if (argLower === 'semua' || argLower === 'lengkap') {
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

    if (argLower === 'besok') {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      if (isSundayJakarta(tomorrow)) {
        return {
          handled: true,
          command: cmd,
          reply:
            'Besok adalah hari Minggu (libur sekolah). Ketik /jadwal Senin atau /jadwal lengkap untuk melihat jadwal belajar.',
        };
      }
      const tomorrowDay = getTodayIndonesianDay(tomorrow);
      const list = sortSchedulesForDay(ctx.schedules, tomorrowDay);
      if (list.length === 0) {
        return {
          handled: true,
          command: cmd,
          reply: `Belum ada jadwal tercatat untuk besok (${tomorrowDay}).`,
        };
      }
      const rows = list.map(
        (s) => `${s.order}. ${s.subject} (${formatScheduleTimeRange(s.startTime, s.endTime)})`
      );
      return {
        handled: true,
        command: cmd,
        reply: `Jadwal Pelajaran Besok (${tomorrowDay}):\n${rows.join('\n')}`,
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
    let active = ctx.assignments
      .filter((a) => deriveTaskStatus(a.dueDate, ctx.taskProgressMap.get(a.id), todayStr) !== 'selesai')
      .slice()
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    let titlePrefix = 'Daftar Tugas Aktif';
    if (argLower === 'terlambat') {
      active = active.filter(
        (a) => deriveTaskStatus(a.dueDate, ctx.taskProgressMap.get(a.id), todayStr) === 'terlambat'
      );
      titlePrefix = 'Daftar Tugas Terlambat';
    } else if (argLower === 'penting' || argLower === 'tinggi') {
      active = active.filter((a) => a.priority === 'tinggi');
      titlePrefix = 'Daftar Tugas Prioritas Tinggi';
    } else if (argLower) {
      active = active.filter(
        (a) =>
          a.subject.toLowerCase().includes(argLower) || a.title.toLowerCase().includes(argLower)
      );
      titlePrefix = `Tugas Terkait "${arg}"`;
    }

    if (active.length === 0) {
      return {
        handled: true,
        command: cmd,
        reply: argLower
          ? `Tidak ditemukan tugas aktif untuk filter "${arg}".`
          : 'Hebat! Tidak ada tugas sekolah aktif yang belum selesai saat ini.',
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
      reply: `${titlePrefix} (${active.length}):\n${rows.join('\n')}`,
    };
  }

  if (cmd === '/pengumuman') {
    let active = ctx.announcements
      .filter((a) => !a.archived)
      .slice()
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));

    if (argLower === 'penting' || argLower === 'mendesak') {
      active = active.filter((a) => a.pinned || a.priority !== 'normal');
    }

    if (active.length === 0) {
      return {
        handled: true,
        command: cmd,
        reply:
          argLower === 'penting'
            ? 'Tidak ada pengumuman penting atau mendesak saat ini.'
            : 'Belum ada pengumuman aktif di Kelas 6A.',
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
    const lines = [
      'Ringkasan Uang Kas Kelas 6A:',
      `• Saldo Tersedia: ${formatRupiah(summary.balance)}`,
      `• Total Pemasukan: ${formatRupiah(summary.totalIncome)}`,
      `• Total Pengeluaran: ${formatRupiah(summary.totalExpense)}`,
      `• Target Kas Mingguan: ${formatRupiah(ctx.settings.weeklyKasTarget)}`,
    ];

    if (argLower === 'terbaru' || argLower === 'pemasukan' || argLower === 'pengeluaran') {
      const filtered = ctx.treasury
        .filter((e) => (argLower === 'terbaru' ? true : e.type === argLower))
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);
      if (filtered.length > 0) {
        lines.push('', `Transaksi (${argLower}):`);
        filtered.forEach((e, idx) => {
          const sign = e.type === 'pemasukan' ? '+' : '-';
          lines.push(`${idx + 1}. ${e.date} · ${sign}${formatRupiah(e.amount)} · ${e.description}`);
        });
      } else {
        lines.push('', `Belum ada transaksi untuk filter "${arg}".`);
      }
    }

    return {
      handled: true,
      command: cmd,
      reply: lines.join('\n'),
    };
  }

  if (cmd === '/anggota' || cmd === '/siswa') {
    const members = ctx.members ?? [];
    if (members.length === 0) {
      return {
        handled: true,
        command: cmd,
        reply: 'Data daftar anggota belum termuat.',
      };
    }
    const owners = members.filter((m) => m.role === 'owner').length;
    const admins = members.filter((m) => m.role === 'admin').length;
    const students = members
      .filter((m) => m.role === 'siswa')
      .slice()
      .sort((a, b) => a.absenNumber - b.absenNumber);
    const activeCount = members.filter((m) => m.status === 'aktif').length;

    const lines = [
      `Data Anggota Kelas 6A (${members.length} akun · ${activeCount} aktif):`,
      `• Owner: ${owners} | Admin: ${admins} | Siswa: ${students.length}`,
    ];
    if (students.length > 0) {
      lines.push(
        '',
        'Daftar Siswa (maks. 12 pertama):',
        ...students.slice(0, 12).map(
          (s) =>
            `• Absen ${s.absenNumber || '-'}: ${s.displayName} (${s.nickname}) [${
              s.status === 'aktif' ? 'Aktif' : 'Nonaktif'
            }]`
        )
      );
    }
    return {
      handled: true,
      command: cmd,
      reply: lines.join('\n'),
    };
  }

  if (cmd === '/pesan') {
    const msgs = ctx.adminMessages ?? [];
    const pending = msgs.filter((m) => m.status === 'menunggu');
    const readOnly = msgs.filter((m) => m.status === 'dibaca');
    if (pending.length === 0 && readOnly.length === 0) {
      return {
        handled: true,
        command: cmd,
        reply: 'Semua pesan siswa untuk Admin sudah selesai ditindaklanjuti.',
      };
    }
    const preview = [...pending, ...readOnly]
      .slice(0, 5)
      .map(
        (m, idx) =>
          `${idx + 1}. [${m.status.toUpperCase()}] ${m.senderName} — ${m.subject} (${m.category})`
      );
    return {
      handled: true,
      command: cmd,
      reply: [
        `Pesan Siswa untuk Admin (${pending.length} menunggu, ${readOnly.length} dibaca):`,
        ...preview,
      ].join('\n'),
    };
  }

  return {
    handled: true,
    command: cmd,
    reply: `Perintah "${cmd}" tidak dikenali. Ketik /menu untuk melihat daftar perintah Bot C6A v1, atau kirim pertanyaan tanpa garis miring (/) untuk bertanya ke C6A AI v1.`,
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
