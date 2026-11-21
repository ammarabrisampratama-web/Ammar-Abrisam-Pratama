import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSpamCooldown, inspectMessageSafety, validateReportInput } from './moderation';
import {
  buildDmRoomId,
  formatBytesCompact,
  formatDurationSec,
  isSafeExternalHttpUrl,
  isValidWhatsAppGroupUrl,
  OFFICIAL_WHATSAPP_GROUP_URL,
  validateMediaFile,
} from './mediaUtils';
import { formatRelativeLastSeen, validatePicketInput } from './validation';

test('inspectMessageSafety blocks phishing, unsafe links, bullying, and public PII', () => {
  assert.equal(inspectMessageSafety('Halo teman-teman, besok bawa buku paket ya!').allowed, true);
  assert.equal(inspectMessageSafety('javascript:alert(1)').allowed, false);
  assert.equal(inspectMessageSafety('Ayo klaim diamond gratis FF di link ini').allowed, false);
  assert.equal(inspectMessageSafety('Kamu dasar goblok banget').allowed, false);
  assert.equal(
    inspectMessageSafety('Hubungi WA aku 081234567890 ya', { isPublicRoom: true }).allowed,
    false
  );
  // Private DM allows mentioning digits unless phishing/bullying
  assert.equal(
    inspectMessageSafety('Halaman 1 sampai 081234567890', { isPublicRoom: false }).allowed,
    true
  );
});

test('checkSpamCooldown blocks rapid bursts and repeated duplicates', () => {
  const errRapid = checkSpamCooldown(10000, 10500, 'satu', 'dua', 1500);
  assert.ok(errRapid);

  const errDup = checkSpamCooldown(10000, 13000, 'Ayo mabar sekarang!', 'ayo mabar sekarang!', 1500);
  assert.ok(errDup);

  const ok = checkSpamCooldown(10000, 13000, 'Pesan pertama', 'Pesan berbeda', 1500);
  assert.equal(ok, null);
});

test('validateReportInput enforces valid categories and length', () => {
  assert.ok(validateReportInput({ category: 'spam', reason: 'ab', targetUid: 'u1' }));
  assert.equal(
    validateReportInput({ category: 'spam', reason: 'Mengirim pesan yang sama berulang kali', targetUid: 'u1' }),
    null
  );
});

test('validateMediaFile enforces MIME types and size limits', () => {
  assert.equal(validateMediaFile({ type: 'image/jpeg', size: 1024 * 1024, name: 'foto.jpg' }, 'image'), null);
  assert.ok(validateMediaFile({ type: 'application/x-msdownload', size: 1000, name: 'app.exe' }, 'image'));
  assert.ok(validateMediaFile({ type: 'video/mp4', size: 20 * 1024 * 1024, name: 'besar.mp4' }, 'video'));
  assert.equal(validateMediaFile({ type: 'video/mp4', size: 5 * 1024 * 1024, name: 'kecil.mp4' }, 'video'), null);
  assert.equal(validateMediaFile({ type: 'audio/webm;codecs=opus', size: 250000, name: 'vn.webm' }, 'audio'), null);
});

test('DM room ID is deterministic regardless of participant order', () => {
  assert.equal(buildDmRoomId('uidB', 'uidA'), 'dm_uidA_uidB');
  assert.equal(buildDmRoomId('uidA', 'uidB'), 'dm_uidA_uidB');
  assert.throws(() => buildDmRoomId('uidA', 'uidA'));
});

test('WhatsApp group URL and formatting helpers work accurately', () => {
  assert.equal(isSafeExternalHttpUrl(OFFICIAL_WHATSAPP_GROUP_URL), true);
  assert.equal(isValidWhatsAppGroupUrl(OFFICIAL_WHATSAPP_GROUP_URL), true);
  assert.equal(isSafeExternalHttpUrl('javascript:void(0)'), false);
  assert.equal(isValidWhatsAppGroupUrl('https://evil.example.com/chat'), false);
  assert.equal(formatDurationSec(75), '01:15');
  assert.equal(formatBytesCompact(2048), '2 KB');
});

test('Picket validation and online presence label helpers', () => {
  assert.equal(
    validatePicketInput({
      day: 'Senin',
      students: ['Ammar', 'Budi'],
      tasks: ['Menyapu lantai'],
      coordinator: 'Ammar',
      note: 'Datang awal',
    }),
    null
  );
  assert.ok(
    validatePicketInput({
      day: 'Senin',
      students: ['Ammar'],
      tasks: [],
      coordinator: '',
      note: '',
    })
  );
  assert.equal(formatRelativeLastSeen(Date.now(), true, true), 'Status disembunyikan');
  assert.equal(formatRelativeLastSeen(Date.now(), true, false), 'Online');
});
