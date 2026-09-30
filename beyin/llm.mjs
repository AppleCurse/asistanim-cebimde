// 9router, OpenRouter, Groq ve Edge-TTS istemcisi: sohbet, STT, TTS.
import { spawn } from 'node:child_process';

export class LLMHatasi extends Error {
  constructor(mesaj, { durum, govde } = {}) {
    super(mesaj);
    this.durum = durum;
    this.govde = govde;
  }
}

export class LLMIstemci {
  constructor({
    baseUrl,
    apiKey,
    model,
    sicaklik = 0.4,
    sttModel = 'whisper-large-v3-turbo',
    ttsModel = 'tts-1',
    ttsVoice = 'tr-TR-AhmetNeural',
    zamanAsimi = 120_000,
    openrouterApiKey,
    groqApiKey,
    cerebrasApiKey,
    tavilyApiKey,
  } = {}) {
    this.openrouterApiKey = openrouterApiKey || process.env.OPENROUTER_API_KEY || '';
    this.groqApiKey = groqApiKey || process.env.GROQ_API_KEY || '';
    this.cerebrasApiKey = cerebrasApiKey || process.env.CEREBRAS_API_KEY || '';
    this.tavilyApiKey = tavilyApiKey || process.env.TAVILY_API_KEY || '';

    this.apiKey = apiKey || process.env.LLM_API_KEY || this.openrouterApiKey || '';
    this.baseUrl = (baseUrl || process.env.LLM_BASE_URL || (this.apiKey.startsWith('sk-or-') ? 'https://openrouter.ai/api/v1' : 'http://127.0.0.1:20128/v1')).replace(/\/+$/, '');
    this.model = model || process.env.LLM_MODEL || (this.apiKey.startsWith('sk-or-') ? 'meta-llama/llama-3.3-70b-instruct' : '');
    this.sicaklik = sicaklik;
    this.sttModel = sttModel || process.env.STT_MODEL || 'whisper-large-v3-turbo';
    this.ttsModel = ttsModel || process.env.TTS_MODEL || 'tts-1';
    this.ttsVoice = ttsVoice || process.env.TTS_VOICE || 'tr-TR-AhmetNeural';
    this.zamanAsimi = zamanAsimi;
  }

  _basliklar(ek = {}) {
    const b = { ...ek };
    if (this.apiKey) b.Authorization = `Bearer ${this.apiKey}`;
    if (this.baseUrl.includes('openrouter.ai')) {
      b['HTTP-Referer'] = 'https://github.com/AppleCurse/asistanim-cebimde';
      b['X-Title'] = 'Asistanim Cebimde';
    }
    return b;
  }

  async _istek(yol, secenekler = {}) {
    let yanit;
    try {
      yanit = await fetch(this.baseUrl + yol, { ...secenekler, headers: this._basliklar(secenekler.headers), signal: AbortSignal.timeout(this.zamanAsimi) });
    } catch (hata) {
      throw new LLMHatasi(`LLM ulaşılamadı (${this.baseUrl}): ${hata.message}`);
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
    if (this.baseUrl.includes('openrouter.ai')) {
      this.model = 'meta-llama/llama-3.3-70b-instruct';
      return this.model;
    }
    try {
      const liste = await this.modeller();
      if (liste.length) {
        const tercih = liste.find((m) => /llama-3\.3|sonnet|gpt-4|gemini|kimi|deepseek/i.test(m)) || liste[0];
        this.model = tercih;
        return tercih;
      }
    } catch {
      // 9router yanıt vermezse
    }
    if (this.openrouterApiKey) {
      this.model = 'meta-llama/llama-3.3-70b-instruct';
      return this.model;
    }
    throw new LLMHatasi('Kullanılabilir LLM modeli bulunamadı — panelden bir sağlayıcı bağlayın veya .env ayarlayın');
  }

  /**
   * OpenAI chat/completions. `mesajlar` OpenAI biçiminde; `araclar` function-calling tanımları.
   * Dönen değer: { mesaj, kullanim, model }
   */
  async sohbet(mesajlar, { araclar, model, sicaklik, maksToken } = {}) {
    let modelAdi = model || (await this.modelSagla());
    // Görsel varsa ve model metin-only ise Gemini Vision modeline geç
    const resimVar = mesajlar.some((m) =>
      Array.isArray(m.content) && m.content.some((c) => c.type === 'image_url')
    );
    if (resimVar && !/gemini|gpt-4o|claude-3|vision/i.test(modelAdi)) {
      modelAdi = 'google/gemini-2.5-flash-lite';
    }
    const govde = {
      model: modelAdi,
      messages: mesajlar,
      temperature: sicaklik ?? this.sicaklik,
    };
    if (araclar?.length) {
      govde.tools = araclar;
      govde.tool_choice = 'auto';
    }
    govde.max_tokens = maksToken || 600;
    if (/gpt-oss|o1|o3/i.test(modelAdi)) {
      govde.reasoning_effort = 'low';
    }

    let yanit;
    try {
      yanit = await this._istek('/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(govde),
      });
    } catch (hata) {
      // 9router başarısız olduysa ve OpenRouter anahtarımız varsa OpenRouter'a düş
      if (this.openrouterApiKey && !this.baseUrl.includes('openrouter.ai')) {
        console.log('[LLM] 9router başarısız, OpenRouter yedeğine geçiliyor (meta-llama/llama-3.3-70b-instruct)');
        const yedekIstemci = new LLMIstemci({
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: this.openrouterApiKey,
          model: 'meta-llama/llama-3.3-70b-instruct',
          sicaklik: this.sicaklik,
        });
        return yedekIstemci.sohbet(mesajlar, { araclar, model: 'meta-llama/llama-3.3-70b-instruct', sicaklik, maksToken });
      }
      throw hata;
    }

    const veri = await yanit.json();
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
  async yaziyaCevir(ses, { mime = 'audio/wav', dil = 'tr', model, dosyaAdi } = {}) {
    const groqKey = this.groqApiKey || (this.apiKey.startsWith('gsk_') ? this.apiKey : '');
    if (groqKey) {
      try {
        const form = new FormData();
        const uzanti = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg' }[mime.split(';')[0]] || 'wav';
        form.append('file', new Blob([ses], { type: mime }), dosyaAdi || `ses.${uzanti}`);
        form.append('model', 'whisper-large-v3-turbo');
        if (dil) form.append('language', dil);
        form.append('response_format', 'json');

        const y = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}` },
          body: form,
          signal: AbortSignal.timeout(this.zamanAsimi),
        });
        if (y.ok) {
          const veri = await y.json();
          return (veri.text || '').trim();
        }
      } catch {
        // Groq başarısızsa aşağıda 9router'ı dene
      }
    }

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
    if (!metin || !metin.trim()) return Buffer.alloc(0);
    const sesSecimi = ses || this.ttsVoice || 'tr-TR-EmelNeural';

    // 1. Termux / sistemde edge-tts varsa doğrudan kullan (ücretsiz, doğal Türkçe, ultra hızlı)
    try {
      const sesBuffer = await new Promise((resolve, reject) => {
        const p = spawn('edge-tts', ['--voice', sesSecimi, '--text', metin, '--write-media', '-'], {
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        const parcalar = [];
        p.stdout.on('data', (d) => parcalar.push(d));
        p.on('close', (kod) => {
          if (kod === 0 && parcalar.length > 0) resolve(Buffer.concat(parcalar));
          else reject(new Error(`edge-tts çıkış kodu: ${kod}`));
        });
        p.on('error', reject);
      });
      if (sesBuffer && sesBuffer.length > 0) return sesBuffer;
    } catch {
      // edge-tts kurulu değilse veya hata verirse fallback
    }

    // 2. 9router / OpenAI seslendirme ucu
    const y = await this._istek('/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || this.ttsModel, input: metin, voice: sesSecimi, response_format: format }),
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
