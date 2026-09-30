import test from 'node:test';
import assert from 'node:assert/strict';
import { GorevKuyrugu } from '../beyin/kuyruk.mjs';

test('görev kuyruğu meşgul işi üç denemede tamamlar', async () => {
  const kuyruk = new GorevKuyrugu({ tekrar: 3, bekleme: 0 });
  let deneme = 0;
  const sonuc = await kuyruk.ekle(async ({ deneme: sira }) => {
    deneme++;
    if (sira < 3) throw new Error('meşgul');
    return 'tamam';
  });
  assert.equal(sonuc, 'tamam');
  assert.equal(deneme, 3);
});

test('kuyruk başarısız işi üç denemeden sonra reddeder', async () => {
  const kuyruk = new GorevKuyrugu({ tekrar: 3, bekleme: 0 });
  await assert.rejects(() => kuyruk.ekle(async () => { throw new Error('kapalı'); }), /kapalı/);
});
