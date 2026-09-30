import test from 'node:test';
import assert from 'node:assert/strict';
import { netstringKodla, NetstringAyristirici, pcmToWav, hesaplaRMS } from '../beyin/kopru/sip.mjs';

test('SIP: netstring kodlama ve ayristirma', () => {
  const veri = { command: 'dial', params: '00905550000000' };
  const kodlu = netstringKodla(veri);
  assert.equal(kodlu, `${Buffer.byteLength(JSON.stringify(veri))}:${JSON.stringify(veri)},`);

  const mesajlar = [];
  const ayristirici = new NetstringAyristirici((m) => mesajlar.push(m));

  // Parçalı besleme testi
  const yarim1 = kodlu.slice(0, 10);
  const yarim2 = kodlu.slice(10);
  ayristirici.besle(Buffer.from(yarim1));
  assert.equal(mesajlar.length, 0);
  ayristirici.besle(Buffer.from(yarim2));
  assert.equal(mesajlar.length, 1);
  assert.deepEqual(mesajlar[0], veri);

  // Satır bazlı düz JSON testi
  ayristirici.besle(Buffer.from('{"event":true,"type":"CALL_ESTABLISHED"}\n'));
  assert.equal(mesajlar.length, 2);
  assert.equal(mesajlar[1].type, 'CALL_ESTABLISHED');
});

test('SIP: pcmToWav standart 44 byte RIFF header üretir', () => {
  const pcm = Buffer.alloc(320); // 20ms ses
  const wav = pcmToWav(pcm, 8000, 1);
  assert.equal(wav.length, 44 + 320);
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF');
  assert.equal(wav.subarray(8, 12).toString(), 'WAVE');
  assert.equal(wav.readUInt32LE(24), 8000); // sample rate
  assert.equal(wav.readUInt16LE(22), 1);    // channels
  assert.equal(wav.readUInt16LE(34), 16);   // bits per sample
});

test('SIP: hesaplaRMS sessizlik ve sinyal enerjisini doğru ölçer', () => {
  const sessiz = Buffer.alloc(320);
  assert.equal(hesaplaRMS(sessiz), 0);

  const sinyal = Buffer.alloc(320);
  for (let i = 0; i < 320; i += 2) {
    sinyal.writeInt16LE(1000, i);
  }
  const rms = Math.round(hesaplaRMS(sinyal));
  assert.equal(rms, 1000);
});

// ─── Ses gidiş hattı: arama kapısı + besleyici kendi kendine iyileştirme ───

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { SipKoprusu } from '../beyin/kopru/sip.mjs';

const sessizLog = { bilgi() {}, uyari() {}, hata() {} };

function sahteKopru({ tmp, ...ek }) {
  return new SipKoprusu({
    llm: {},
    gorevler: {},
    ayar: {},
    log: sessizLog,
    port: 59999, // kimse dinlemiyor — bağlantı reddedilir
    fifoDizini: tmp,
    sesKapisiYolu: path.join(tmp, 'ses-kanali-ok'),
    ...ek,
  });
}

test('SIP: arama kapısı — ses testi yeşil değilken arama ÇALDIRILMAZ', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sip-kapi-'));
  const kopru = sahteKopru({ tmp });
  await assert.rejects(
    () => kopru.ara({ numara: '05550000000' }),
    (e) => /ses testi yeşil/.test(e.message),
    'kapı kapalıyken arama başlamamalı',
  );
  // İşaret (ses-testi.sh yeşil sonucu) varsa kapı açılır — engel artık kapı hatası değildir
  fs.writeFileSync(kopru.sesKapisiYolu, '');
  await assert.rejects(
    () => kopru.ara({ numara: '05550000000' }),
    (e) => !/ses testi/.test(e.message),
    'kapı açıkken hata başka bir kaynaktan gelmeli (ctrl_tcp bağlantısı)',
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('SIP: besleyici yazma hatasını yutmaz; sayar, loglar ve fd\'yi yeniden açar', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sip-besleyici-'));
  execFileSync('mkfifo', [path.join(tmp, 'mic.raw'), path.join(tmp, 'spk.raw')]);

  const kayitlar = [];
  const log = {
    bilgi: (...a) => kayitlar.push(['bilgi', a.join(' ')]),
    uyari: (...a) => kayitlar.push(['uyari', a.join(' ')]),
    hata: (...a) => kayitlar.push(['hata', a.join(' ')]),
  };
  const kopru = new SipKoprusu({
    llm: {}, gorevler: {}, ayar: {}, log,
    fifoDizini: tmp,
    sesKapisiYolu: path.join(tmp, 'ses-kanali-ok'),
    yazmaHatasiKurtarmaMs: 50, // testte 5 sn yerine 50 ms
  });

  // Geçersiz fd taklidi: besleyici EBADF görecek — eskiden bunu sessizce yutuyordu
  kopru.inFifoFd = 9999;
  kopru._sesBesleyiciBaslat();
  await new Promise((r) => setTimeout(r, 400));
  clearInterval(kopru.besleyiciZamanlayici);

  assert.ok(kopru.besleyiciHataSayaci >= 1, `yazma hatası SAYILMALI (sayı: ${kopru.besleyiciHataSayaci})`);
  assert.ok(kopru.besleyiciBasariliSayac >= 10, `fd yeniden açılınca paketler akmalı (${kopru.besleyiciBasariliSayac})`);
  assert.ok(
    kayitlar.some(([s, m]) => s === 'uyari' && /mic\.raw/.test(m) && /yazma hatası|yeniden açıldı/.test(m)),
    'yazma hatası loglanmalı: ' + JSON.stringify(kayitlar.slice(-5)),
  );
  assert.ok(
    kayitlar.some(([, m]) => /yeniden açıldı/.test(m)),
    'kendi kendine iyileştirme loglanmalı',
  );

  fs.rmSync(tmp, { recursive: true, force: true });
});
