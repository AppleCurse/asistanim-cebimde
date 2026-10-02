import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** 9router ilk parolasını günlüğe yazmadan yükler veya üretip kalıcılaştırır. */
export function routerIlkSifreAl({
  asistanHome = process.env.ASISTAN_HOME || path.join(process.env.HOME || os.homedir(), '.asistan'),
  ilkSifre = process.env.INITIAL_PASSWORD || '',
} = {}) {
  fs.mkdirSync(asistanHome, { recursive: true, mode: 0o700 });
  fs.chmodSync(asistanHome, 0o700);

  const dosya = path.join(asistanHome, '9router.initial-password');
  let yeniDosya = false;
  try {
    const sifre = ilkSifre || crypto.randomBytes(32).toString('hex');
    if (/[\r\n\0]/.test(sifre)) throw new Error('INITIAL_PASSWORD tek satırlı metin olmalı.');
    const fd = fs.openSync(dosya, 'wx', 0o600);
    yeniDosya = true;
    try {
      fs.writeFileSync(fd, `${sifre}\n`, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch (hata) {
    if (yeniDosya) {
      try { fs.unlinkSync(dosya); } catch {}
    }
    if (hata.code !== 'EEXIST') throw hata;
  }

  const bilgi = fs.lstatSync(dosya);
  if (!bilgi.isFile()) throw new Error('9router başlangıç parolası dosyası normal bir dosya olmalı.');
  fs.chmodSync(dosya, 0o600);
  const sifre = fs.readFileSync(dosya, 'utf8').replace(/\r?\n$/, '');
  if (!sifre) throw new Error('9router başlangıç parolası dosyası boş.');
  return sifre;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${routerIlkSifreAl()}\n`);
  } catch (hata) {
    console.error(`[9router] başlangıç parolası hazırlanamadı: ${hata.message}`);
    process.exitCode = 1;
  }
}
