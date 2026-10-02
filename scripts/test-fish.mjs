import fs from 'node:fs';
import { spawn } from 'node:child_process';

const apiKey = process.env.FISH_AUDIO_API_KEY || 'sk-fish-WLDpk6maAYOLVM9KCSsCDruoMbruMg-YIsbJwX6t1SU';
const voiceId = process.env.FISH_AUDIO_VOICE_ID || '66f55da63a4a47b982ae64723dd79194'; // Haluk Bilginer
const metin = 'Merhaba Salim Bey. Ben Haluk Bilginer sesinizle konuşan yapay zekâ asistanınızım. Sesim nasıl geliyor?';

console.log('Fish Audio TTS testi başlatılıyor...');
const models = ['s2.1-pro-free', 's2.1-pro', 's2', ''];
for (const m of models) {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (m) headers['model'] = m;
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text: metin,
      reference_id: voiceId,
      format: 'mp3',
    }),
  });
  console.log(`Model "${m}" Status:`, res.status);
  if (!res.ok) {
    console.log(`Model "${m}" Hata:`, await res.text());
  } else {
    const mp3Buf = Buffer.from(await res.arrayBuffer());
    console.log(`Model "${m}" BAŞARILI! Boyut:`, mp3Buf.length);
    break;
  }
}

const homeDir = '/data/data/com.termux/files/home/.asistan/veri';
fs.mkdirSync(homeDir, { recursive: true });
const mp3Path = `${homeDir}/haluk-test.mp3`;
const rawPath = `${homeDir}/haluk-test.raw`;
fs.writeFileSync(mp3Path, mp3Buf);

const ffmpegBin = fs.existsSync('/data/data/com.termux/files/usr/bin/ffmpeg')
  ? '/data/data/com.termux/files/usr/bin/ffmpeg'
  : 'ffmpeg';

const ff = spawn(ffmpegBin, [
  '-y',
  '-i', mp3Path,
  '-f', 's16le',
  '-ar', '8000',
  '-ac', '1',
  rawPath
]);

ff.on('close', (kod) => {
  if (kod === 0) {
    const rawStat = fs.statSync(rawPath);
    console.log('FFmpeg 8000Hz PCM RAW Başarılı! Boyut:', rawStat.size, 'bayt');
  } else {
    console.error('FFmpeg hata kodu:', kod);
  }
});
