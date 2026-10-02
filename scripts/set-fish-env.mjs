import fs from 'node:fs';

const envPath = '/data/data/com.termux/files/home/asistanim-cebimde/.env';
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

// Ayarları güncelle veya ekle
const updates = {
  TTS_SAGLAYICI: 'fish_audio',
  FISH_AUDIO_API_KEY: process.env.FISH_AUDIO_API_KEY || process.argv[2] || 'sk-fish-WLDpk6maAYOLVM9KCSsCDruoMbruMg-YIsbJwX6t1SU',
  FISH_AUDIO_VOICE_ID: process.env.FISH_AUDIO_VOICE_ID || '66f55da63a4a47b982ae64723dd79194', // Haluk Bilginer
  ENABLE_9ROUTER: '0',
};

for (const [k, v] of Object.entries(updates)) {
  const reg = new RegExp(`^${k}=.*$`, 'm');
  if (reg.test(env)) {
    env = env.replace(reg, `${k}=${v}`);
  } else {
    env += `\n${k}=${v}`;
  }
}

fs.writeFileSync(envPath, env, 'utf8');
console.log('.env başarıyla güncellendi: Fish Audio (Haluk Bilginer) aktif!');
