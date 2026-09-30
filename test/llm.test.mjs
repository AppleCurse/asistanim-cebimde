import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LLMIstemci } from '../beyin/llm.mjs';

test('LLMIstemci: ElevenLabs yapılandırması varsayılanları doğru yükler', () => {
  const istemci = new LLMIstemci({
    elevenlabsApiKey: 'test-key-123',
    ttsSaglayici: 'elevenlabs',
  });
  assert.equal(istemci.elevenlabsApiKey, 'test-key-123');
  assert.equal(istemci.elevenlabsVoiceId, 'cgSgspJ2msm6clMCkdW9');
  assert.equal(istemci.elevenlabsModel, 'eleven_multilingual_v2');
  assert.equal(istemci.ttsSaglayici, 'elevenlabs');
});

test('LLMIstemci.seslendir: boş metinde boş Buffer döner', async () => {
  const istemci = new LLMIstemci();
  const res = await istemci.seslendir('   ');
  assert.equal(res.length, 0);
});

test('LLMIstemci.seslendir: ElevenLabs yapılandırıldığında doğru API çağrısı yapar ve ses döner', async () => {
  const orijinalFetch = globalThis.fetch;
  let cagrilanUrl = '';
  let cagrilanSecenekler = null;

  globalThis.fetch = async (url, options) => {
    cagrilanUrl = String(url);
    cagrilanSecenekler = options;
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode('sahte-elevenlabs-mp3').buffer,
    };
  };

  const telemetriKayitlari = [];
  const sahteTelemetri = { yaz: (tur, veri) => telemetriKayitlari.push({ tur, veri }) };

  try {
    const istemci = new LLMIstemci({
      elevenlabsApiKey: 'el-key-xyz',
      elevenlabsVoiceId: 'test-ses-id',
      ttsSaglayici: 'elevenlabs',
      telemetry: sahteTelemetri,
    });

    const sesBuffer = await istemci.seslendir('Merhaba dünya');
    assert.equal(sesBuffer.toString(), 'sahte-elevenlabs-mp3');
    assert.equal(cagrilanUrl, 'https://api.elevenlabs.io/v1/text-to-speech/test-ses-id');
    assert.equal(cagrilanSecenekler.headers['xi-api-key'], 'el-key-xyz');
    assert.equal(cagrilanSecenekler.headers['Content-Type'], 'application/json');

    const govde = JSON.parse(cagrilanSecenekler.body);
    assert.equal(govde.text, 'Merhaba dünya');
    assert.equal(govde.model_id, 'eleven_multilingual_v2');

    const ttsLog = telemetriKayitlari.find((k) => k.tur === 'tts');
    assert.ok(ttsLog);
    assert.equal(ttsLog.veri.motor, 'elevenlabs');
    assert.equal(ttsLog.veri.karakter, 13);
  } finally {
    globalThis.fetch = orijinalFetch;
  }
});

test('LLMIstemci.seslendir: ElevenLabs başarısız olduğunda yedek motora düşer', async () => {
  const orijinalFetch = globalThis.fetch;
  let elevenlabsCagrildi = false;
  let speechCagrildi = false;

  globalThis.fetch = async (url, options) => {
    const s = String(url);
    if (s.includes('elevenlabs.io')) {
      elevenlabsCagrildi = true;
      return {
        ok: false,
        status: 402,
        text: async () => 'paid_plan_required',
      };
    }
    if (s.includes('/audio/speech')) {
      speechCagrildi = true;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new TextEncoder().encode('yedek-mp3').buffer,
      };
    }
    return { ok: false, status: 404 };
  };

  try {
    const istemci = new LLMIstemci({
      baseUrl: 'http://127.0.0.1:20128/v1',
      apiKey: 'sahte',
      elevenlabsApiKey: 'el-key-hata',
      ttsSaglayici: 'elevenlabs',
    });

    const sesBuffer = await istemci.seslendir('Hata testi');
    assert.ok(elevenlabsCagrildi, 'ElevenLabs çağrılmış olmalı');
    assert.ok(sesBuffer && sesBuffer.length > 0, 'Yedek motordan (edge-tts veya 9router) ses üretilmiş olmalı');
    if (speechCagrildi) {
      assert.equal(sesBuffer.toString(), 'yedek-mp3');
    }
  } finally {
    globalThis.fetch = orijinalFetch;
  }
});
