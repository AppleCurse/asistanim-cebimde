// Testler için minik OpenAI-uyumlu sunucu (9router taklidi).
// Senaryo: kullanıcı "pil" derse önce pil_durumu aracını çağırır, araç sonucu gelince cevap verir.
// Diğer mesajlara sabit yanıt döner. JSON isteyen istemlere brifing/özet JSON'u döner.

import http from 'node:http';

export function sahte9RouterBaslat() {
  const istekler = [];
  const ayarlar = {};
  const sunucu = http.createServer(async (req, res) => {
    const parcalar = [];
    for await (const p of req) parcalar.push(p);
    const ham = Buffer.concat(parcalar);
    const json = (kod, veri) => {
      res.writeHead(kod, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(veri));
    };

    if (req.url === '/v1/models') return json(200, { data: [{ id: 'sahte/model-1' }, { id: 'sahte/sonnet' }] });

    if (req.url === '/v1/chat/completions') {
      const govde = JSON.parse(ham.toString('utf8'));
      istekler.push(govde);
      const sistem = govde.messages.find((m) => m.role === 'system')?.content || '';
      const son = govde.messages[govde.messages.length - 1];
      const sonKullanici = [...govde.messages].reverse().find((m) => m.role === 'user');
      const kullaniciMetni = typeof sonKullanici?.content === 'string' ? sonKullanici.content : JSON.stringify(sonKullanici?.content || '');
      const yanit = (message, finish_reason = 'stop') =>
        json(200, { id: 'x', model: govde.model, choices: [{ index: 0, message, finish_reason }], usage: { prompt_tokens: 10, completion_tokens: 5 } });

      // Brifing üretimi
      if (sistem.includes('görev planlayıcısısın')) {
        return yanit({
          role: 'assistant',
          content: JSON.stringify({
            baslik: 'Ahmet ile toplantı erteleme',
            kisi: { ad: 'Ahmet Yılmaz', numara: '+905551112233', iliski: 'iş ortağı' },
            amac: 'Yarınki toplantıyı 16:00’a ertelemek',
            konusma_noktalari: ['Selamla ve kendini tanıt', 'Erteleme talebini ilet', 'Yeni saati teyit et'],
            kabul_edilebilir_sonuclar: ['Yarın 16:00', 'Perşembe herhangi bir saat'],
            sinirlar: ['Ücret konuşma'],
            ton: 'kibar, kısa',
            acilis: 'Merhaba Ahmet Bey, ben Test Kullanıcı’nın dijital asistanı Cebi.',
            basari_kriteri: 'Yeni saat teyit edildi',
            eksik_bilgi: [],
          }),
        });
      }
      // Cebimon iş planı üretimi
      if (sistem.includes('güvenlik odaklı Türkçe bir iş planlayıcısısın')) {
        return yanit({ role: 'assistant', content: JSON.stringify({
          baslik: 'Saç örme', ortam: 'kişisel bakım', risk: 'dusuk', adimlar: [
            { metin: 'Kamerayı saç hizasına al', aciklama: 'Saçı iyi ışıkta kadraja al.', guvenlik: 'Kamerayı sabitle.' },
            { metin: 'Bölümleri ayır', aciklama: 'Saçı nazikçe bölümlere ayır.', guvenlik: 'Çekiştirme.' },
            { metin: 'Örgüyü başlat', aciklama: 'Bölümleri sırayla geçir.', guvenlik: 'Saçı fazla sıkma.' },
          ],
        }) });
      }
      // Cebimon'un görsel/ses adım doğrulaması
      if (sistem.includes('kanıta dayalı ve güvenlik odaklı bir görev adımı doğrulayıcısısın')) {
        const sonuc = ayarlar.cebiDegerlendirme || { tamamlandi: true, guvenli: true, guven: 0.94, gozlem: 'Adımın sonucu görüntüde doğrulanıyor.', geri_bildirim: 'Adım tamamlandı.', sonraki_adim: 'Sıradaki adıma geç.' };
        return yanit({ role: 'assistant', content: JSON.stringify(sonuc) });
      }
      // Görüşme özeti
      if (sistem.includes('transkriptini değerlendir')) {
        return yanit({ role: 'assistant', content: '```json\n{"basarili": true, "ozet": "Toplantı 16:00’a alındı.", "kararlar": ["Yarın 16:00"], "takip": ["Takvimi güncelle"], "not": null}\n```' });
      }
      // Telefon görüşmesi kişiliği
      if (sistem.includes('TELEFONDA konuşuyorsun') || sistem.includes('SESLİ sohbet')) {
        if (/hoşça kal|görüşürüz|kapat/i.test(kullaniciMetni)) return yanit({ role: 'assistant', content: 'Teşekkürler, iyi günler. [GORUSME_BITTI]' });
        return yanit({ role: 'assistant', content: 'Anladım, yarın saat on altı uygun mu?' });
      }
      // Araç döngüsü
      if (son.role === 'tool') return yanit({ role: 'assistant', content: `Araç sonucu: ${son.content}` });
      if (/saçını ör|tamir edeceğim|arabaya bak|yağını değiştireceğim/i.test(kullaniciMetni) && govde.tools?.some((t) => t.function.name === 'cebi_planla')) {
        return yanit({ role: 'assistant', content: null, tool_calls: [{ id: 'cp1', type: 'function', function: { name: 'cebi_planla', arguments: JSON.stringify({ talimat: kullaniciMetni }) } }] }, 'tool_calls');
      }
      if (/pil/i.test(kullaniciMetni) && govde.tools?.some((t) => t.function.name === 'pil_durumu')) {
        return yanit({ role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'pil_durumu', arguments: '{}' } }] }, 'tool_calls');
      }
      if (/bak/i.test(kullaniciMetni) && govde.tools?.some((t) => t.function.name === 'bak')) {
        return yanit({ role: 'assistant', content: null, tool_calls: [{ id: 'c2', type: 'function', function: { name: 'bak', arguments: '{"kamera":0}' } }] }, 'tool_calls');
      }
      return yanit({ role: 'assistant', content: 'Merhaba, ben sahte asistan.' });
    }

    if (req.url === '/v1/audio/transcriptions') return json(200, { text: 'sahte transkript' });
    if (req.url === '/v1/audio/speech') {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      return res.end(Buffer.from('ID3sahte-mp3'));
    }
    json(404, { error: 'yok' });
  });

  return new Promise((coz) => {
    sunucu.listen(0, '127.0.0.1', () => coz({ sunucu, url: `http://127.0.0.1:${sunucu.address().port}/v1`, istekler, ayarlar }));
  });
}
