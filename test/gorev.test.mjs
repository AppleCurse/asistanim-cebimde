import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GorevYoneticisi } from '../beyin/gorev.mjs';

const sessizLog = { bilgi() {}, uyari() {}, hata() {} };

function kur() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gorev-'));
  let llmCagri = 0;
  const llm = {
    jsonSohbet: async () => {
      llmCagri++;
      return { basarili: true, ozet: 'Konuşma özeti', kararlar: ['X'], takip: ['Y'], not: null };
    },
  };
  const g = new GorevYoneticisi({
    llm, ayar: { kullanici: { ad: 'T' } }, hafiza: { hatirla() {} }, log: sessizLog, dizin: tmp,
  });
  return { g, tmp, sayac: () => llmCagri };
}

test('ozetle: transkript boşsa LLM çağrılmaz, dürüst iptal kapanışı yazılır', async () => {
  const { g, tmp, sayac } = kur();
  const gorev = g.kaydet({ id: 'bos-1', baslik: 'Test', kisi: { ad: 'A' }, amac: 'ara', transkript: [], sonuc: null });
  const kapali = await g.ozetle({ ...gorev }, { sebep: 'karsi-kapatti' });
  assert.equal(sayac(), 0, 'boş transkripte LLM çağrısı israf olmalı');
  assert.equal(kapali.durum, 'iptal');
  assert.equal(kapali.sonuc.basarili, false);
  assert.match(kapali.sonuc.ozet, /açmadı|başlamadan/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('ozetle: transkript varsa LLM çağrılır, durum kapanır', async () => {
  const { g, tmp, sayac } = kur();
  const gorev = g.kaydet({
    id: 'dolu-1', baslik: 'Test', kisi: { ad: 'A' }, amac: 'ara',
    transkript: [{ rol: 'karsi', metin: 'merhaba' }, { rol: 'asistan', metin: 'selam' }], sonuc: null,
  });
  const kapali = await g.ozetle({ ...gorev }, { sebep: 'asistan-kapatti' });
  assert.equal(sayac(), 1);
  assert.equal(kapali.durum, 'tamamlandi');
  assert.equal(kapali.sonuc.basarili, true);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('sil: görev ve yarım yazım kalıntısı temizlenir', async () => {
  const { g, tmp } = kur();
  g.kaydet({ id: 'sil-1', baslik: 'X' });
  fs.writeFileSync(path.join(tmp, 'sil-1.json.tmp'), '{yarim');
  assert.equal(g.sil('sil-1'), true);
  assert.ok(!fs.existsSync(path.join(tmp, 'sil-1.json')), 'görev dosyası silinmeli');
  assert.ok(!fs.existsSync(path.join(tmp, 'sil-1.json.tmp')), 'tmp kalıntısı silinmeli');
  assert.equal(g.sil('sil-1'), false, 'ikinci silme false dönmeli');
  fs.rmSync(tmp, { recursive: true, force: true });
});
