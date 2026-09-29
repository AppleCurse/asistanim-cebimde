import test from 'node:test';
import assert from 'node:assert/strict';
import { netstringKodla, NetstringAyristirici, pcmToWav, hesaplaRMS } from '../beyin/kopru/sip.mjs';

test('SIP: netstring kodlama ve ayristirma', () => {
  const veri = { command: 'dial', params: '00905407254626' };
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
