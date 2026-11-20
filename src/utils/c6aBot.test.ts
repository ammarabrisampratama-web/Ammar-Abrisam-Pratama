import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSanitizedC6AContextSummary,
  extractChatBotQuery,
  runC6ABotCommand,
} from './c6aBot';
import { buildDefaultOfficialScheduleItems, DEFAULT_CLASS_SETTINGS } from './validation';
import type {
  AdminMessage,
  AgendaItem,
  Announcement,
  Assignment,
  TreasuryEntry,
  UserPublic,
} from '../types';

const sampleContext = () => {
  const settings = { ...DEFAULT_CLASS_SETTINGS, updatedAt: null };
  const schedules = buildDefaultOfficialScheduleItems();
  const assignments: Assignment[] = [
    {
      id: 't1',
      classId: '6A',
      subject: 'Matematika',
      title: 'Latihan Pecahan',
      description: 'Hal 20',
      assignedDate: '2026-11-18',
      dueDate: '2026-11-25',
      priority: 'tinggi',
      authorId: 'u1',
      authorName: 'Fauzan',
      authorRole: 'siswa',
      editHistory: [],
      createdAt: null,
      updatedAt: null,
    },
    {
      id: 't2',
      classId: '6A',
      subject: 'IPAS',
      title: 'Laporan Ekosistem',
      description: 'Buku paket hal 45',
      assignedDate: '2026-11-10',
      dueDate: '2026-11-15',
      priority: 'sedang',
      authorId: 'u2',
      authorName: 'Nadia',
      authorRole: 'siswa',
      editHistory: [],
      createdAt: null,
      updatedAt: null,
    },
  ];
  const announcements: Announcement[] = [
    {
      id: 'ann1',
      classId: '6A',
      title: 'Upacara Hari Senin',
      content: 'Seragam lengkap.',
      category: 'Penting',
      priority: 'penting',
      pinned: true,
      archived: false,
      authorId: 'o1',
      authorName: 'Wali Kelas',
      authorRole: 'owner',
      createdAt: null,
      updatedAt: null,
    },
  ];
  const agendas: AgendaItem[] = [
    {
      id: 'ag1',
      classId: '6A',
      title: 'Kerja Bakti Kelas',
      description: 'Bawa kemoceng',
      eventDate: '2026-11-28',
      eventTime: '07:30',
      location: 'Ruang 6A',
      status: 'mendatang',
      authorId: 'o1',
      authorName: 'Wali Kelas',
      createdAt: null,
      updatedAt: null,
    },
  ];
  const treasury: TreasuryEntry[] = [
    {
      id: 'k1',
      classId: '6A',
      type: 'pemasukan',
      amount: 50000,
      description: 'Iuran Pekan 1',
      category: 'Iuran Kas',
      studentName: 'Fauzan',
      paymentStatus: 'lunas',
      correctionNote: '',
      date: '2026-11-19',
      recordedById: 'o1',
      recordedByName: 'Owner',
      createdAt: null,
      updatedAt: null,
    },
    {
      id: 'k2',
      classId: '6A',
      type: 'pengeluaran',
      amount: 15000,
      description: 'Beli Spidol Papan Tulis',
      category: 'Perlengkapan',
      studentName: '',
      paymentStatus: 'lunas',
      correctionNote: '',
      date: '2026-11-20',
      recordedById: 'o1',
      recordedByName: 'Owner',
      createdAt: null,
      updatedAt: null,
    },
  ];
  const members: UserPublic[] = [
    {
      uid: 'o1',
      displayName: 'Ammar Abrisam',
      nickname: 'Ammar',
      absenNumber: 0,
      role: 'owner',
      classId: '6A',
      status: 'aktif',
      photoURL: '',
      lastLoginAt: null,
      updatedAt: null,
    },
    {
      uid: 's1',
      displayName: 'Fauzan Alif',
      nickname: 'Fauzan',
      absenNumber: 7,
      role: 'siswa',
      classId: '6A',
      status: 'aktif',
      photoURL: '',
      lastLoginAt: null,
      updatedAt: null,
    },
  ];
  const adminMessages: AdminMessage[] = [
    {
      id: 'm1',
      classId: '6A',
      senderId: 's1',
      senderName: 'Fauzan',
      category: 'Izin',
      subject: 'Izin Susulan Matematika',
      message: 'Izin susulan hari Senin.',
      status: 'menunggu',
      adminReply: '',
      repliedBy: '',
      createdAt: null,
      updatedAt: null,
    },
  ];

  return {
    settings,
    schedules,
    assignments,
    taskProgressMap: new Map(),
    announcements,
    agendas,
    treasury,
    members,
    adminMessages,
    now: new Date('2026-11-20T03:00:00Z'), // Jumat WIB
  };
};

test('C6A Bot v1 handles /menu, /rekap, /jadwal (including besok), /tugas filters, /kas filters, /pengumuman, /agenda, /anggota, and /pesan', () => {
  const ctx = sampleContext();

  const menuRes = runC6ABotCommand('/menu', ctx);
  assert.equal(menuRes.handled, true);
  assert.equal(menuRes.reply.includes('Bot C6A v1'), true);
  assert.equal(menuRes.reply.includes('/rekap'), true);
  assert.equal(menuRes.reply.includes('/anggota'), true);
  assert.equal(menuRes.reply.includes('/pesan'), true);

  const rekapRes = runC6ABotCommand('/rekap', ctx);
  assert.equal(rekapRes.handled, true);
  assert.equal(rekapRes.reply.includes('Rekap Harian Bot C6A v1'), true);
  assert.equal(rekapRes.reply.includes('2 tugas (1 terlambat)'), true);
  assert.equal(rekapRes.reply.includes('Rp 35.000'), true);
  assert.equal(rekapRes.reply.includes('1 pesan'), true);
  assert.equal(rekapRes.reply.includes('2 akun'), true);

  const jadwalSenin = runC6ABotCommand('/jadwal Senin', ctx);
  assert.equal(jadwalSenin.handled, true);
  assert.equal(jadwalSenin.reply.includes('Pancasila'), true);
  assert.equal(jadwalSenin.reply.includes('Aswaja'), true);

  const jadwalBesok = runC6ABotCommand('/jadwal besok', ctx);
  assert.equal(jadwalBesok.handled, true);
  assert.equal(jadwalBesok.reply.includes('Sabtu'), true);

  const jadwalSabtuBesok = runC6ABotCommand('/jadwal besok', {
    ...ctx,
    now: new Date('2026-11-21T03:00:00Z'), // Sabtu WIB -> Besok Minggu
  });
  assert.equal(jadwalSabtuBesok.reply.includes('hari Minggu'), true);

  const tugasRes = runC6ABotCommand('/tugas', ctx);
  assert.equal(tugasRes.handled, true);
  assert.equal(tugasRes.reply.includes('Latihan Pecahan'), true);

  const tugasTerlambat = runC6ABotCommand('/tugas terlambat', ctx);
  assert.equal(tugasTerlambat.reply.includes('Laporan Ekosistem'), true);
  assert.equal(tugasTerlambat.reply.includes('Latihan Pecahan'), false);

  const tugasMat = runC6ABotCommand('/tugas matematika', ctx);
  assert.equal(tugasMat.reply.includes('Latihan Pecahan'), true);
  assert.equal(tugasMat.reply.includes('Laporan Ekosistem'), false);

  const kasRes = runC6ABotCommand('/kas terbaru', ctx);
  assert.equal(kasRes.handled, true);
  assert.equal(kasRes.reply.includes('Rp 35.000'), true);
  assert.equal(kasRes.reply.includes('Beli Spidol Papan Tulis'), true);

  const annRes = runC6ABotCommand('/pengumuman penting', ctx);
  assert.equal(annRes.reply.includes('Upacara Hari Senin'), true);

  const agRes = runC6ABotCommand('/agenda', ctx);
  assert.equal(agRes.reply.includes('Kerja Bakti Kelas'), true);

  const anggotaRes = runC6ABotCommand('/anggota', ctx);
  assert.equal(anggotaRes.reply.includes('Fauzan Alif'), true);
  assert.equal(anggotaRes.reply.includes('Owner: 1 | Admin: 0 | Siswa: 1'), true);

  const pesanRes = runC6ABotCommand('/pesan', ctx);
  assert.equal(pesanRes.reply.includes('Izin Susulan Matematika'), true);

  const plainRes = runC6ABotCommand('Apa rumus luas lingkaran?', ctx);
  assert.equal(plainRes.handled, false);

  for (const restrictedCmd of ['/jadwal', '/rekap', '/anggota', '/pesan', '/kas']) {
    const siswaDenied = runC6ABotCommand(restrictedCmd, ctx, 'siswa');
    assert.equal(siswaDenied.handled, true);
    assert.equal(siswaDenied.reply.includes('hanya dapat digunakan oleh Admin dan Owner'), true);
  }

  const adminAllowed = runC6ABotCommand('/rekap', ctx, 'admin');
  assert.equal(adminAllowed.reply.includes('Rekap Harian Bot C6A v1'), true);
});

test('C6A chat trigger allows AI (@C6A) for siswa/admin/owner and restricts Bot (/) to admin/owner', () => {
  // Siswa using @C6A <question> -> triggers AI
  assert.deepEqual(extractChatBotQuery('@C6A jelaskan pecahan', 'siswa'), {
    isBotTrigger: true,
    mode: 'ai',
    queryText: 'jelaskan pecahan',
  });
  // Siswa mentioning @c6a without args -> triggers AI greeting instead of Bot /menu
  assert.equal(extractChatBotQuery('@c6a', 'siswa').mode, 'ai');
  // Siswa typing slash command -> does NOT trigger Bot
  assert.deepEqual(extractChatBotQuery('/jadwal rabu', 'siswa'), {
    isBotTrigger: false,
    mode: null,
    queryText: '',
  });
  // Admin & Owner typing slash command or bare @c6a -> triggers Bot
  assert.deepEqual(extractChatBotQuery('/jadwal rabu', 'admin'), {
    isBotTrigger: true,
    mode: 'bot',
    queryText: '/jadwal rabu',
  });
  assert.deepEqual(extractChatBotQuery('@c6a', 'owner'), {
    isBotTrigger: true,
    mode: 'bot',
    queryText: '/menu',
  });
  assert.deepEqual(extractChatBotQuery('Halo teman-teman 6A', 'owner'), {
    isBotTrigger: false,
    mode: null,
    queryText: '',
  });
});

test('C6A sanitized context builder includes class info without leaking private credentials', () => {
  const ctx = sampleContext();
  const summary = buildSanitizedC6AContextSummary(ctx);
  assert.equal(summary.includes('Matematika'), true);
  assert.equal(summary.includes('Latihan Pecahan'), true);
  assert.equal(summary.includes('Rp 35.000'), true);
  assert.equal(summary.includes('password'), false);
});
