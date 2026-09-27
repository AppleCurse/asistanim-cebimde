// 9router (veya herhangi bir OpenAI-uyumlu uç) istemcisi: sohbet, STT, TTS.

export class LLMHatasi extends Error {
  constructor(mesaj, { durum, govde } = {}) {
    super(mesaj);
    this.durum = durum;
    this.govde = govde;
  }
}

export class LLMIstemci {
  constructor({ baseUrl, apiKey, model, sicaklik = 0.4, sttModel = 'whisper-1', ttsModel = 'tts-1', ttsVoice = 'alloy', zamanAsimi = 120_000 }) {
    this.baseUrl = (baseUrl || 'http://127.0.0.1:20128/v1').replace(/\/+$/, '');
    this.apiKey = apiKey || '';
    this.model = model || '';
    this.sicaklik = sicaklik;
    this.sttModel = sttModel;
    this.ttsModel = ttsModel;
    this.ttsVoice = ttsVoice;
    this.zamanAsimi = zamanAsimi;
  }

  _basliklar(ek = {}) {
    const b = { ...ek };
    if (this.apiKey) b.Authorization = `Bearer ${this.apiKey}`;
    return b;
  }

  async _istek(yol, secenekler = {}) {
    let yanit;
    try {
      yanit = await fetch(this.baseUrl + yol, { ...secenekler, headers: this._basliklar(secenekler.headers), signal: AbortSignal.timeout(this.zamanAsimi) });
    } catch (hata) {
      throw new LLMHatasi(`9router'a ulaşılamadı (${this.baseUrl}): ${hata.message}`);
    }
    if (!yanit.ok) {
      const govde = await yanit.text().catch(() => '');
      throw new LLMHatasi(`LLM isteği başarısız (${yanit.status}) ${yol}: ${govde.slice(0, 400)}`, { durum: yanit.status, govde });
    }
    return yanit;
  }

  async modeller() {
    const y = await this._istek('/models');
    const veri = await y.json();
    return (veri.data || []).map((m) => m.id);
  }

  /** Model belirtilmemişse listeden makul bir tane seçer. */
  async modelSagla() {
    if (this.model) return this.model;
    const liste = await this.modeller();
    if (!liste.length) throw new LLMHatasi('9router hiç model döndürmedi — panelden bir sağlayıcı bağlayın');
    const tercih = liste.find((m) => /sonnet|gpt-4|gemini-2|glm|kimi|deepseek/i.test(m)) || liste[0];
    this.model = tercih;
    return tercih;
  }

  /**
   * OpenAI chat/completions. `mesajlar` OpenAI biçiminde; `araclar` function-calling tanımları.
   * Dönen değer: { mesaj, kullanim, model }
   */
  async sohbet(mesajlar, { araclar, model, sicaklik, maksToken } = {}) {
    const govde = {
      model: model || (await this.modelSagla()),
      messages: mesajlar,
      temperature: sicaklik ?? this.sicaklik,
    };
    if (araclar?.length) {
      govde.tools = araclar;
      govde.tool_choice = 'auto';
    }
    if (maksToken) govde.max_tokens = maksToken;

    const y = await this._istek('/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
    });
    const veri = await y.json();
    const secim = veri.choices?.[0];
    if (!secim?.message) throw new LLMHatasi('LLM boş yanıt döndürdü', { govde: JSON.stringify(veri).slice(0, 400) });
    return { mesaj: secim.message, kullanim: veri.usage, model: veri.model || govde.model, bitis: secim.finish_reason };
  }

  /** Metin isteyip JSON bekleyen çağrılar için toleranslı ayrıştırıcı. */
  async jsonSohbet(mesajlar, secenekler = {}) {
    const { mesaj } = await this.sohbet(mesajlar, { ...secenekler, sicaklik: secenekler.sicaklik ?? 0.2 });
    return jsonAyikla(mesaj.content);
  }

  /** Ses → metin. `ses` Buffer; `mime` örn. audio/webm, audio/mp4, audio/wav */
  async yaziyaCevir(ses, { mime = 'audio/webm', dil = 'tr', model, dosyaAdi } = {}) {
    const form = new FormData();
    const uzanti = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg' }[mime.split(';')[0]] || 'bin';
    form.append('file', new Blob([ses], { type: mime }), dosyaAdi || `ses.${uzanti}`);
    form.append('model', model || this.sttModel);
    if (dil) form.append('language', dil);
    form.append('response_format', 'json');
    const y = await this._istek('/audio/transcriptions', { method: 'POST', body: form });
    const veri = await y.json();
    return (veri.text || '').trim();
  }

  /** Metin → ses (Buffer). */
  async seslendir(metin, { model, ses, format = 'mp3' } = {}) {
    const y = await this._istek('/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || this.ttsModel, input: metin, voice: ses || this.ttsVoice, response_format: format }),
    });
    return Buffer.from(await y.arrayBuffer());
  }
}

/** Yanıtın içinden ilk JSON nesnesini çıkarır (```json çitleri, açıklama metni vb. tolere edilir). */
export function jsonAyikla(metin) {
  if (!metin) throw new LLMHatasi('JSON bekleniyordu, boş içerik geldi');
  const temiz = String(metin).replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(temiz);
  } catch {
    /* aşağıda dene */
  }
  const bas = temiz.indexOf('{');
  const son = temiz.lastIndexOf('}');
  if (bas >= 0 && son > bas) {
    try {
      return JSON.parse(temiz.slice(bas, son + 1));
    } catch {
      /* düş */
    }
  }
  throw new LLMHatasi(`JSON ayrıştırılamadı: ${temiz.slice(0, 200)}`);
}
