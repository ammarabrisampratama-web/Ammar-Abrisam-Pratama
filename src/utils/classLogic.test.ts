import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultOfficialScheduleItems,
  buildTreasuryCsv,
  calculateMonthlyTreasuryRecap,
  calculateTreasurySummary,
  canAccessNavTab,
  canChangeUserRole,
  canCreateAgenda,
  canCreateAssignment,
  canEditOrDeleteOwnedItem,
  canManageAnnouncements,
  canManageSchedule,
  canManageTreasury,
  canViewLoginHistory,
  deriveTaskStatus,
  detectNewAnnouncements,
  evaluateDayScheduleStatus,
  formatRupiah,
  formatScheduleTimeRange,
  getEffectiveSchedules,
  getTodayIndonesianDay,
  matchesOfficial6DaySchedule,
  OFFICIAL_6_DAY_SCHEDULE,
  performGlobalSearch,
  sortSchedulesForDay,
  validateAdminMessageInput,
  validateAgendaInput,
  validateAnnouncementInput,
  validateAssignmentInput,
  validateChatText,
  validateProfileInput,
  validateScheduleInput,
  validateTreasuryInput,
} from './validation';
import type { AdminMessage, Announcement, ScheduleItem, TreasuryEntry } from '../types';

test('RBAC: Owner, Admin, and Siswa permissions follow Master Prompt spec', () => {
  assert.equal(canViewLoginHistory('owner'), true);
  assert.equal(canViewLoginHistory('admin'), false);
  assert.equal(canViewLoginHistory('siswa'), false);

  assert.equal(canAccessNavTab('owner', 'owner-panel'), true);
  assert.equal(canAccessNavTab('admin', 'owner-panel'), false);
  assert.equal(canAccessNavTab('siswa', 'owner-panel'), false);

  assert.equal(canManageAnnouncements('owner'), true);
  assert.equal(canManageAnnouncements('admin'), true);
  assert.equal(canManageAnnouncements('siswa'), false);

  // Students can create tasks and agendas
  assert.equal(canCreateAssignment('siswa'), true);
  assert.equal(canCreateAgenda('siswa'), true);
  assert.equal(canCreateAssignment('siswa', { allowStudentCreateTask: false }), false);

  // Owner toggles admin permission for treasury & schedule
  assert.equal(canManageTreasury('admin', { allowAdminManageTreasury: false }), false);
  assert.equal(canManageTreasury('owner', { allowAdminManageTreasury: false }), true);
  assert.equal(canManageSchedule('admin', { allowAdminManageSchedule: false }), false);

  // Students can edit/delete their own tasks/agendas, Admin/Owner can edit/delete any
  assert.equal(canEditOrDeleteOwnedItem('siswa', 'u1', 'u1'), true);
  assert.equal(canEditOrDeleteOwnedItem('siswa', 'u1', 'u2'), false);
  assert.equal(canEditOrDeleteOwnedItem('admin', 'a1', 'u2'), true);

  assert.equal(canChangeUserRole('owner', 'siswa', 'admin'), true);
  assert.equal(canChangeUserRole('owner', 'owner', 'siswa'), false);
  assert.equal(canChangeUserRole('admin', 'siswa', 'admin'), false);
});

test('Official 6-day curriculum & unconfigured times behave cleanly', () => {
  assert.deepEqual(OFFICIAL_6_DAY_SCHEDULE.Senin, ['Pancasila', 'Matematika', 'SKI', 'BTQ', 'Akidah', 'Aswaja']);
  assert.deepEqual(OFFICIAL_6_DAY_SCHEDULE.Selasa, ['PJOK', 'Matematika', 'IPAS', 'BTQ', 'TIK']);
  assert.deepEqual(OFFICIAL_6_DAY_SCHEDULE.Rabu, ['Pancasila', 'BTQ', 'Bahasa Arab', 'Bahasa Indonesia', 'IPAS']);
  assert.deepEqual(OFFICIAL_6_DAY_SCHEDULE.Kamis, ["Al-Qur'an Hadis", 'BTQ', 'Bahasa Indonesia', 'Matematika', 'Bahasa Inggris']);
  assert.deepEqual(OFFICIAL_6_DAY_SCHEDULE.Jumat, ['Bahasa Indonesia', 'IPAS', 'Bahasa Jawa']);
  assert.deepEqual(OFFICIAL_6_DAY_SCHEDULE.Sabtu, ['Fikih', 'Seni Budaya', 'Bahasa Indonesia']);

  assert.equal(formatScheduleTimeRange('', ''), 'Belum diatur');
  assert.equal(formatScheduleTimeRange('07:00', '08:15'), '07:00 – 08:15');

  const slots: ScheduleItem[] = [
    { id: '2', classId: '6A', day: 'Senin', order: 2, startTime: '07:45', endTime: '08:30', subject: 'Matematika', teacher: '', room: '', authorId: 'o1', updatedAt: null },
    { id: '1', classId: '6A', day: 'Senin', order: 1, startTime: '07:00', endTime: '07:45', subject: 'Pancasila', teacher: '', room: '', authorId: 'o1', updatedAt: null },
  ];
  const sorted = sortSchedulesForDay(slots, 'Senin');
  assert.deepEqual(sorted.map((s) => s.order), [1, 2]);

  const evalMid = evaluateDayScheduleStatus(sorted, '07:15');
  assert.equal(evalMid.currentLesson?.subject, 'Pancasila');
  assert.equal(evalMid.nextLesson?.subject, 'Matematika');
  assert.equal(evalMid.hasConfiguredTimes, true);
});

test('Validation: allows empty schedule times and enforces schema bounds', () => {
  assert.equal(validateProfileInput('Ahmad Fauzan', 'Fauzan', 12, false), null);
  assert.equal(validateProfileInput('Ahmad Fauzan', '', 12, false) !== null, true);

  assert.equal(validateScheduleInput({ day: 'Senin', order: 1, startTime: '', endTime: '', subject: 'Pancasila', teacher: '', room: '' }), null);
  assert.equal(validateScheduleInput({ day: 'Senin', order: 1, startTime: '08:00', endTime: '', subject: 'Pancasila', teacher: '', room: '' }) !== null, true);

  assert.equal(validateAnnouncementInput({ title: 'Ujian Praktik', content: 'Jadwal ujian dimulai Senin.', category: 'Akademik', priority: 'penting' }), null);
  assert.equal(validateAssignmentInput({ subject: 'Matematika', title: 'Latihan Pecahan', description: 'Hal 42', assignedDate: '2026-11-19', dueDate: '2026-11-25', priority: 'tinggi' }), null);
  assert.equal(validateAgendaInput({ title: 'Rapat Kelas', description: 'Persiapan lomba', eventDate: '2026-12-01', eventTime: '', location: 'Ruang 6A' }), null);
  assert.equal(validateTreasuryInput({ type: 'pemasukan', amount: 15000, description: 'Iuran Kas', category: 'Iuran Kas', studentName: 'Fauzan', paymentStatus: 'lunas', correctionNote: '', date: '2026-11-19' }), null);
  assert.equal(validateChatText('Assalamualaikum') , null);
  assert.equal(validateAdminMessageInput({ category: 'Izin', subject: 'Izin Sakit', message: 'Mohon izin tidak masuk.' }), null);
});

test('Task overdue derivation, treasury monthly recap & CSV export work accurately', () => {
  assert.equal(deriveTaskStatus('2026-11-10', 'belum', '2026-11-19'), 'terlambat');
  assert.equal(deriveTaskStatus('2026-11-10', 'selesai', '2026-11-19'), 'selesai');
  assert.equal(deriveTaskStatus('2026-11-25', 'sedang', '2026-11-19'), 'sedang');

  const entries: TreasuryEntry[] = [
    { id: '1', classId: '6A', type: 'pemasukan', amount: 250000, description: 'Kas Okt', category: 'Iuran Kas', studentName: '', paymentStatus: 'lunas', correctionNote: '', date: '2026-10-15', recordedById: 'o1', recordedByName: 'Owner', createdAt: null, updatedAt: null },
    { id: '2', classId: '6A', type: 'pemasukan', amount: 100000, description: 'Kas Nov', category: 'Iuran Kas', studentName: '', paymentStatus: 'lunas', correctionNote: '', date: '2026-11-05', recordedById: 'o1', recordedByName: 'Owner', createdAt: null, updatedAt: null },
    { id: '3', classId: '6A', type: 'pengeluaran', amount: 40000, description: 'Spidol', category: 'Perlengkapan', studentName: '', paymentStatus: 'operasional', correctionNote: '', date: '2026-11-12', recordedById: 'o1', recordedByName: 'Owner', createdAt: null, updatedAt: null },
  ];
  const summary = calculateTreasurySummary(entries);
  assert.equal(summary.balance, 310000);
  assert.equal(formatRupiah(summary.balance), 'Rp 310.000');

  const recap = calculateMonthlyTreasuryRecap(entries);
  assert.equal(recap[0].monthKey, '2026-11');
  assert.equal(recap[0].net, 60000);

  const csv = buildTreasuryCsv(entries);
  assert.equal(csv.includes('Kas Okt'), true);
});

test('Global search respects student RBAC on private admin messages', () => {
  const adminMessages: AdminMessage[] = [
    { id: 'm1', classId: '6A', senderId: 's1', senderName: 'Siswa 1', category: 'Izin', subject: 'Izin Rahasia Satu', message: 'Sakit', status: 'menunggu', adminReply: '', repliedBy: '', createdAt: null, updatedAt: null },
    { id: 'm2', classId: '6A', senderId: 's2', senderName: 'Siswa 2', category: 'Izin', subject: 'Izin Rahasia Dua', message: 'Sakit', status: 'menunggu', adminReply: '', repliedBy: '', createdAt: null, updatedAt: null },
  ];
  const studentResults = performGlobalSearch({
    query: 'Rahasia',
    role: 'siswa',
    currentUid: 's1',
    assignments: [],
    announcements: [],
    agendas: [],
    schedules: [],
    adminMessages,
    chatMessages: [],
  });
  assert.equal(studentResults.length, 1);
  assert.equal(studentResults[0].title, 'Izin Rahasia Satu');

  const ownerResults = performGlobalSearch({
    query: 'Rahasia',
    role: 'owner',
    currentUid: 'o1',
    assignments: [],
    announcements: [],
    agendas: [],
    schedules: [],
    adminMessages,
    chatMessages: [],
  });
  assert.equal(ownerResults.length, 2);
});

test('Real-time announcement detector & Indonesian day helper', () => {
  const a1: Announcement = {
    id: 'a1',
    classId: '6A',
    title: 'Awal',
    content: 'Konten awal',
    category: 'Umum',
    priority: 'normal',
    pinned: false,
    archived: false,
    authorId: 'o1',
    authorName: 'Wali Kelas',
    authorRole: 'owner',
    createdAt: null,
    updatedAt: null,
  };
  const a2: Announcement = { ...a1, id: 'a2', title: 'Terbaru' };
  assert.deepEqual(detectNewAnnouncements([a1], new Set(), false), []);
  assert.deepEqual(detectNewAnnouncements([a2, a1], new Set(['a1']), true).map((a) => a.id), ['a2']);
  assert.equal(getTodayIndonesianDay(new Date('2026-11-20T03:00:00Z')), 'Jumat');
});

test('Official 6-day fallback generator and exact curriculum matcher', () => {
  const fallback = getEffectiveSchedules([]);
  assert.equal(fallback.isUsingFallback, true);
  assert.equal(fallback.items.length, 27);
  assert.equal(matchesOfficial6DaySchedule(fallback.items), true);
  assert.equal(formatScheduleTimeRange(fallback.items[0].startTime, fallback.items[0].endTime), 'Belum diatur');

  // Stale partial list should be detected as mismatched
  const staleOnlyTwo = buildDefaultOfficialScheduleItems().slice(0, 2);
  assert.equal(matchesOfficial6DaySchedule(staleOnlyTwo), false);
  const effectiveWithFirestore = getEffectiveSchedules(staleOnlyTwo);
  assert.equal(effectiveWithFirestore.isUsingFallback, false);
  assert.equal(effectiveWithFirestore.items.length, 2);
});
