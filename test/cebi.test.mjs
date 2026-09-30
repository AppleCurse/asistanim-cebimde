import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Cebimon } from '../beyin/cebi.mjs';

test('Cebimon bağlama göre kamera görev tahtası üretir', () => {
  const dosya = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cebi-')), 'durum.json');
  const c = new Cebimon({ dosya });
  const o = c.planla('Arabanın yağını değiştireceğim, bana yardım et');
  assert.equal(o.ortam, 'otomobil');
  assert.equal(o.risk, 'orta');
  assert.ok(o.adimlar.length >= 4);
  assert.equal(o.adimlar[0].durum, 'aktif');
  assert.equal(JSON.parse(fs.readFileSync(dosya)).oturum.ortam, 'otomobil');
});

test('Cebimon tamamlanan oturumu günlük olaya yazar', () => {
  const dosya = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cebi-')), 'durum.json');
  const c = new Cebimon({ dosya });
  c.planla('Bir belgeyi incele');
  c.oturumBitir({ ozet: 'Belge incelendi' });
  assert.equal(c.veri.oturum, null);
  assert.equal(c.veri.gunluk.at(-1).metin, 'Belge incelendi');
});
