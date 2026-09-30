import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Cebimon } from '../beyin/cebi.mjs';
import { ARACLAR } from '../beyin/araclar.mjs';

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


test('Cebimon fail-closed risk normalizasyonu, akıllı plan yedeği ve atomik kayıt', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cebi-'));
  const dosya = path.join(dir, 'durum.json');
  const c = new Cebimon({ dosya, ad: 'Aspasia' });
  const oturum = c.oturumBaslat({ amac: 'elektrik panosuna müdahale', risk: 'yüksek risk' });
  assert.equal(oturum.risk, 'yuksek');
  assert.equal(c.oturumBaslat({ amac: 'routine', risk: 'HIGH RISK' }).risk, 'yuksek');
  assert.throws(() => c.adim('tehlikeli işlem', 'bilinmeyen'), /geçersiz adım durumu/);
  const llm = { jsonSohbet: async () => ({ baslik: 'Plan', ortam: 'ev', risk: 'dusuk', adimlar: [
    { metin: 'A', guvenlik: '' }, { metin: 'B', guvenlik: '' }, { metin: 'C', guvenlik: '' },
  ] }) };
  const plan = await c.planlaAkilli('Elektrik panosuna müdahale et', llm);
  assert.equal(plan.risk, 'yuksek', 'yerel tehlike algısı, LLM düşük önerse bile düşürülemez');
  assert.equal(plan.planKaynak, 'llm');
  assert.equal(JSON.parse(fs.readFileSync(dosya)).ad, 'Aspasia');
});

test('Cebimon yüksek risk ve arşivi korur, geçersiz adım durumu reddedilir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cebi-'));
  const dosya = path.join(dir, 'durum.json');
  const c = new Cebimon({ dosya, ad: 'Aspasia' });
  assert.throws(() => c.adim('x', 'bypass'), /geçersiz adım durumu/);
  assert.throws(() => c.adim('x', 'tamamlandi'), /geçersiz adım durumu/);
  const atlananRisk = c.oturumBaslat({ amac: 'gaz kaçağını onar', risk: 'dusuk' });
  assert.equal(atlananRisk.risk, 'yuksek', 'oturum API parametresi tehlikeli işi düşük riske indiremez');
  c.planla('Elektrik panosunu tamir et');
  assert.equal(c.veri.oturum.risk, 'yuksek');
  c.planla('ELEKTRİK panosuna yaklaş');
  assert.equal(c.veri.oturum.risk, 'yuksek', 'büyük Türkçe İ risk kontrolünü atlatmamalı');
  assert.equal(JSON.parse(fs.readFileSync(dosya)).ad, 'Aspasia');
  c.oturumBitir({ basarili: false, ozet: 'yarım' });
  assert.equal(c.veri.gecmis.length, 3);
  c.temizle();
  assert.equal(c.veri.ad, 'Aspasia');
  assert.equal(c.veri.gecmis.length, 0);
});

test('Cebimon bozuk JSON dosyasını kurtarma kopyası olarak korur', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cebi-'));
  const dosya = path.join(dir, 'durum.json');
  fs.writeFileSync(dosya, '{broken', { mode: 0o600 });
  const c = new Cebimon({ dosya });
  assert.ok(c.veri.kurtarmaDosyasi);
  const yedek = c.veri.kurtarmaDosyasi;
  assert.equal(fs.readFileSync(yedek, 'utf8'), '{broken');
  c.kaydet();
  assert.equal(JSON.parse(fs.readFileSync(dosya)).ad, 'Cebimon');
  c.temizle();
  assert.equal(fs.existsSync(yedek), false, 'kişisel veri temizliği kurtarma kopyasını da silmeli');
});


test('cebi_planla aracı yalnızca bir kez kaydedilir', () => {
  assert.equal(ARACLAR.filter((a) => a.tanim.function.name === 'cebi_planla').length, 1);
});
