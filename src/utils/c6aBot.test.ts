import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSanitizedC6AContextSummary,
  extractChatBotQuery,
  runC6ABotCommand,
} from './c6aBot';
import { buildDefaultOfficialScheduleItems, DEFAULT_CLASS_SETTINGS } from './validation';
import type { AgendaItem, Announcement, Assignment, TreasuryEntry } from '../types';

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
  ];

  return {
    settings,
    schedules,
    assignments,
    taskProgressMap: new Map(),
    announcements,
    agendas,
    treasury,
    now: new Date('2026-11-20T03:00:00Z'), // Jumat WIB
  };
};

test('C6A Bot handles /jadwal, /tugas, /kas, /pengumuman, /agenda, and /menu accurately', () => {
  const ctx = sampleContext();

  const menuRes = runC6ABotCommand('/menu', ctx);
  assert.equal(menuRes.handled, true);
  assert.equal(menuRes.reply.includes('/jadwal'), true);

  const jadwalSenin = runC6ABotCommand('/jadwal Senin', ctx);
  assert.equal(jadwalSenin.handled, true);
  assert.equal(jadwalSenin.reply.includes('Pancasila'), true);
  assert.equal(jadwalSenin.reply.includes('Aswaja'), true);

  const tugasRes = runC6ABotCommand('/tugas', ctx);
  assert.equal(tugasRes.handled, true);
  assert.equal(tugasRes.reply.includes('Latihan Pecahan'), true);

  const kasRes = runC6ABotCommand('/kas', ctx);
  assert.equal(kasRes.handled, true);
  assert.equal(kasRes.reply.includes('Rp 50.000'), true);

  const annRes = runC6ABotCommand('/pengumuman', ctx);
  assert.equal(annRes.reply.includes('Upacara Hari Senin'), true);

  const agRes = runC6ABotCommand('/agenda', ctx);
  assert.equal(agRes.reply.includes('Kerja Bakti Kelas'), true);

  const plainRes = runC6ABotCommand('Apa rumus luas lingkaran?', ctx);
  assert.equal(plainRes.handled, false);

  const siswaDenied = runC6ABotCommand('/jadwal', ctx, 'siswa');
  assert.equal(siswaDenied.handled, true);
  assert.equal(siswaDenied.reply.includes('hanya dapat digunakan oleh Admin dan Owner'), true);

  const adminAllowed = runC6ABotCommand('/jadwal Senin', ctx, 'admin');
  assert.equal(adminAllowed.reply.includes('Pancasila'), true);
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
  assert.equal(summary.includes('Rp 50.000'), true);
  assert.equal(summary.includes('password'), false);
});
