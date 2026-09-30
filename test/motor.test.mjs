import test from 'node:test';
import assert from 'node:assert/strict';
import { Gorusme, halusinasyonMu, HALUSINASYON_KALIPLARI } from '../beyin/kopru/motor.mjs';

const sessizLog = { bilgi() {}, uyari() {}, hata() {} };

function sahteGorusme({ yaziyaCevir, sohbet, seslendir } = {}) {
  const durumlar = [];
  const tasiyici = {
    metin() {},
    sesCal: async () => {},
    sesDurdur() {},
    durum: (d) => durumlar.push(d),
    bitti() {},
  };
  const llm = {
    yaziyaCevir: yaziyaCevir || (async () => 'merhaba orada mısın'),
    sohbet: sohbet || (async () => ({ mesaj: { content: 'Tabii, hallediyorum.' } })),
    seslendir: seslendir || (async () => Buffer.alloc(64)),
  };
  const gorusme = new Gorusme({
    llm,
    gorevler: { guncelle() {}, ozetle: async (g) => g, aramaSistemMesaji: () => '' },
    gorev: null,
    ayar: { kullanici: { asistanAdi: 'Aspasia', ad: 'Test' }, arama: {} },
    tasiyici,
    log: sessizLog,
    mod: 'sunucu-ses',
  });
  return { gorusme, durumlar, tasiyici };
}

test('halusinasyonMu: STT uydurma kalıplarını yakalar', () => {
  assert.ok(halusinasyonMu('altyazılar hazırlanmıştır'));
  assert.ok(halusinasyonMu('Subtitles by Amara.org'));
  assert.ok(halusinasyonMu('Videoyu izlediğiniz için teşekkürler'));
  assert.ok(halusinasyonMu('Beğenmeyi ve abone olmayı unutmayın'));
  assert.ok(halusinasyonMu('Thanks for watching!'));
  assert.ok(halusinasyonMu('[Müzik]'));
  assert.ok(halusinasyonMu('(alkış)'));
  assert.ok(halusinasyonMu('♪ ♪ ♪'));
  assert.ok(halusinasyonMu('www.ornek.com'));
  assert.ok(halusinasyonMu(''));
  assert.ok(halusinasyonMu('a'), 'tek karakter anlamlı söz sayılmaz');
});

test('halusinasyonMu: gerçek sözü geçirir (kalıp listesi fazla yakalamaz)', () => {
  assert.ok(!halusinasyonMu('Yarınki toplantıyı 16:00\'a erteleyelim'));
  assert.ok(!halusinasyonMu('Merhaba, nasılsınız?'));
  assert.ok(!halusinasyonMu('Abone olmak istiyorum bu yayına'), 'gerçek cümle kalıp değil');
  assert.ok(!halusinasyonMu('Videodaki adresi bana yazar mısın?'));
  assert.ok(HALUSINASYON_KALIPLARI.length >= 10, 'kalıp listesi derli toplu olmalı');
});

test('Gorusme.durum: dusunuyor → konusuyor takibi (dusununuyor hatası yok)', async () => {
  let coz;
  const { gorusme, durumlar } = sahteGorusme({
    sohbet: () => new Promise((r) => { coz = r; }),
  });
  await gorusme.baslat();
  assert.equal(gorusme.durum, 'konusuyor', 'açılış cümlesi söyleniyor');

  const yanit = gorusme.kullaniciKonustu('merhaba, bir şey soracağım');
  await new Promise((r) => setImmediate(r));
  assert.equal(gorusme.durum, 'dusunuyor', 'LLM yanıtı beklenirken durum dusunuyor olmalı');
  assert.ok(!durumlar.some((d) => d.asama === 'dusununuyor'), 'dusununuyor yazım hatası geri gelmemeli');

  coz({ mesaj: { content: 'Tabii, dinliyorum.' } });
  await yanit;
  assert.equal(gorusme.durum, 'konusuyor');
  await gorusme.bitir('test-bitti'); // 900 sn'lik süre zamanlayıcısını temizler
});

test('sesGeldi: halüsinasyon transkripte geçmez, bekliyor durumuna düşer', async () => {
  const { gorusme, durumlar } = sahteGorusme({
    yaziyaCevir: async () => 'Videoyu izlediğiniz için teşekkürler',
  });
  await gorusme.sesGeldi(Buffer.alloc(200), 'audio/wav');
  assert.equal(gorusme.transkript.length, 0, 'halüsinasyon transkripte yazılmamalı');
  assert.equal(gorusme.durum, 'bekliyor');
  assert.ok(durumlar.some((d) => d.asama === 'bekliyor'));

  // Gerçek söz geçmeli
  const { gorusme: g2 } = sahteGorusme({ yaziyaCevir: async () => 'Toplantıyı erteleyelim' });
  await g2.sesGeldi(Buffer.alloc(200), 'audio/wav');
  assert.equal(g2.transkript[0].rol, 'karsi', 'kullanıcının sözü transkripte geçmeli');
  assert.match(g2.transkript[0].metin, /Toplantıyı/);
});

test('bitir: çağrı hiç başlamasa bile görev kapanır (araniyor\'da takılma kapanışı)', async () => {
  const bitisler = [];
  const ozetlemeler = [];
  const tasiyici = {
    metin() {}, sesCal: async () => {}, sesDurdur() {}, durum() {},
    bitti: (_g, ek) => bitisler.push(ek.sebep),
  };
  const llm = {
    sohbet: async () => ({ mesaj: { content: 'x' } }),
    seslendir: async () => Buffer.alloc(4),
    yaziyaCevir: async () => '',
  };
  const gorevler = {
    guncelle() {},
    ozetle: async (g, { sebep }) => { ozetlemeler.push(sebep); return { ...g, durum: 'iptal' }; },
    aramaSistemMesaji: () => '',
  };
  const g = new Gorusme({
    llm, gorevler, gorev: { id: 't1', transkript: [] },
    ayar: { kullanici: { ad: 'T' }, arama: {} }, tasiyici, log: sessizLog, mod: 'sunucu-ses',
  });
  // baslat ÇALIŞTIRILMADI: aranana hiç ulaşılmadı (meşgul / açmadı → CALL_CLOSED)
  await g.bitir('karsi-kapatti');
  assert.deepEqual(bitisler, ['karsi-kapatti'], 'görev kapanışı bir kez yapılmalı');
  assert.deepEqual(ozetlemeler, ['karsi-kapatti'], 'görev özetlenip kapanmalı');
  await g.bitir('ikinci');
  assert.equal(bitisler.length, 1, 'ikinci bitir no-op olmalı');
  assert.equal(ozetlemeler.length, 1);
});
