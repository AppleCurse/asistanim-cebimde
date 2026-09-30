// Panel — cebindeki telefondan asistanı yönetme ekranı.
const $ = (s) => document.querySelector(s);

// LLM/kullanıcı metnini innerHTML'e gömerken HTML kaçışı (XSS sertleştirmesi)
const kacir = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// /bak ile çekilen son görsel: bir sonraki sohbet mesajına eklenir ("bu ne?" diye sorabilmek için)
let bekleyenGorsel = null;

// URL'den veya localStorage'dan token al ve sakla
const urlToken = new URLSearchParams(window.location.search).get('token');
if (urlToken) {
  try { localStorage.setItem('asistan_token', urlToken); } catch {}
}
const aktifToken = urlToken || (() => { try { return localStorage.getItem('asistan_token'); } catch { return null; } })() || '';

let bildirimZamanlayici;
function bildir(metin, hata = false) {
  const el = $('#bildirim');
  if (!el) return;
  el.textContent = metin;
  el.classList.toggle('toast-hata', hata);
  el.hidden = false;
  clearTimeout(bildirimZamanlayici);
  bildirimZamanlayici = setTimeout(() => { el.hidden = true; }, 6000);
}

async function api(yol, govde) {
  const ayirici = yol.includes('?') ? '&' : '?';
  const url = aktifToken ? `/api${yol}${ayirici}token=${encodeURIComponent(aktifToken)}` : `/api${yol}`;
  const basliklar = {
    ...(govde ? { 'Content-Type': 'application/json' } : {}),
    ...(aktifToken ? { 'Authorization': `Bearer ${aktifToken}` } : {}),
  };
  let y;
  try {
    y = await fetch(url, {
      method: govde ? 'POST' : 'GET',
      headers: basliklar,
      body: govde ? JSON.stringify(govde) : undefined,
    });
  } catch (agHatasi) {
    throw new Error('Bağlantı hatası (' + agHatasi.message + ')');
  }
  const veri = await y.json().catch(() => ({}));
  if (!y.ok) {
    throw new Error(veri.hata || y.statusText || `Sunucu hatası (HTTP ${y.status})`);
  }
  return veri;
}

// Sayfa içi linklere token ekle
document.addEventListener('DOMContentLoaded', () => {
  if (aktifToken) {
    document.querySelectorAll('a[href^="/telefon"]').forEach((a) => {
      if (!a.href.includes('token=')) {
        a.href += (a.href.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(aktifToken);
      }
    });
  }
});

function balon(sinif, metin, resim) {
  const d = document.createElement('div');
  d.className = 'balon ' + sinif;
  d.textContent = metin;
  if (resim) {
    const img = document.createElement('img');
    img.src = resim;
    d.appendChild(img);
  }
  $('#sohbet').appendChild(d);
  $('#sohbet').scrollTop = $('#sohbet').scrollHeight;
  return d;
}

function adimNotu(adimlar) {
  if (!adimlar?.length) return;
  const d = document.createElement('div');
  d.className = 'adim';
  d.textContent = '⚙ ' + adimlar.map((a) => a.arac).join(' → ');
  $('#sohbet').appendChild(d);
}

const sinifAdlari = { kivilcim: 'Kıvılcım', nobetci: 'Nöbetçi', sekreter: 'Sekreter', gezgin: 'Gezgin', operator: 'Operatör', usta: 'Usta' };
const modAdlari = { hazir: 'Hazır', nobette: 'Nöbette', dusunuyor: 'Düşünüyor', konusuyor: 'Konuşuyor', supheli: 'Onay bekliyor', yarali: 'Desteğe ihtiyacı var' };
function cebiTahtayiCiz(oturum) {
  const hedef = $('#cebiTahta');
  if (!oturum) { hedef.innerHTML = '<p class="soluk">Henüz açık bir iş planı yok.</p>'; return; }
  const adimlar = (oturum.adimlar || []).map((a) => {
    const ikon = a.durum === 'tamamlandi' ? '✓' : a.durum === 'aktif' ? '→' : a.durum === 'onay_bekliyor' ? '!' : '○';
    const inceleme = a.incelemeler?.at(-1);
    return `<li class="plan-adim ${kacir(a.durum)}"><b>${ikon} ${kacir(a.metin)}</b>${inceleme ? `<p class="soluk">${kacir(inceleme.geriBildirim || inceleme.gozlem)} · güven %${Math.round(inceleme.guven * 100)}</p>` : ''}</li>`;
  }).join('');
  const aktif = oturum.adimlar?.find((a) => a.durum === 'aktif');
  const bekleyen = oturum.adimlar?.find((a) => a.durum === 'onay_bekliyor');
  hedef.innerHTML = `<div class="cebi-plan-kart">
    <div class="ust"><strong>${kacir(oturum.ortam)} · ${kacir(oturum.risk)} risk</strong><span class="hazir-rozet">${oturum.tamamlandi ? 'Tamamlandı' : oturum.bekleyenOnay ? 'Onay bekliyor' : 'Devam ediyor'}</span></div>
    <p class="soluk">${kacir(oturum.amac)}</p><ol class="plan-adimlar">${adimlar}</ol>
    <div class="eylemler">
      ${aktif ? '<button class="buton birincil" data-cebi-eylem="incele">📷🎙 Aktif adımı doğrula</button>' : ''}
      ${bekleyen ? '<button class="buton birincil" data-cebi-eylem="onay">Adımı onayla</button><button class="buton tehlike" data-cebi-eylem="reddet">Onaylama</button>' : ''}
      ${oturum.tamamlandi ? '<button class="buton" data-cebi-eylem="bitir">Oturumu bitir</button>' : ''}
    </div>
  </div>`;
}

async function cebimonYukle() {
  try {
    const c = await api('/cebi');
    $('#cebiAd').textContent = c.ad;
    $('#cebiBaslikAciklama').textContent = `Bir cümleyle işi anlat; ${c.ad} adımları hazırlasın.`;
    $('#cebiSinif').textContent = sinifAdlari[c.sinif] || c.sinif;
    $('#cebiMod').textContent = modAdlari[c.mod] || c.mod;
    $('#cebiCihaz').textContent = c.cihaz?.pil != null ? `Pil %${c.cihaz.pil}${c.cihaz.sicaklik ? ` · ${c.cihaz.sicaklik}°C` : ''}` : 'Cihaz hazır';
    $('#cebiMesaj').textContent = c.oturum ? `${c.oturum.ortam} · ${c.oturum.amac || 'yanında çalışıyor'}` : (c.gunluk?.notlar?.at(-1)?.metin || 'Ben buradayım. Bana ne yapacağını öğret.');
    $('#cebiYuz').textContent = c.mod === 'yarali' ? '!' : c.mod === 'dusunuyor' ? '…' : '✦';
    cebiTahtayiCiz(c.oturum);
  } catch { $('#cebiMesaj').textContent = 'Bağlantı kuruluyor…'; }
}

document.querySelectorAll('.cebi-aksiyon').forEach((b) => b.addEventListener('click', async () => {
  const o = await api('/cebi/oturum', { ortam: b.dataset.ortam, amac: b.dataset.amac, risk: b.dataset.ortam === 'is' ? 'orta' : 'dusuk' });
  await api('/cebi/adim', { metin: 'Kamerayı ve ortamı hazırla', durum: 'aktif' });
  await cebimonYukle();
  balon('sistem', `${o.ortam} oturumu başladı. ${o.amac}`);
  $('#mesaj').focus();
}));

async function durumYukle() {
  try {
    const d = await api('/durum');
    $('#asistanAdi').textContent = d.asistan + (d.kullanici ? ` · ${d.kullanici}` : '');
    const yasiyor = d.beden?.durum === 'yasiyor';
    $('#nabiz').className = 'nabiz' + (yasiyor ? ' yasiyor' : '');
    const pil = yasiyor ? await api('/pil', {}).catch(() => null) : null;
    const maliyet = await api('/maliyet?gun=1').catch(() => null);
    const rozet = (b, s) => `<div class="rozet"><b>${kacir(b)}</b><span>${s}</span></div>`;
    $('#durum').innerHTML =
      rozet('Beden', yasiyor ? `yaşıyor (${kacir(d.beden.mod)})` : '<span class="hata">ulaşılamıyor</span>') +
      rozet('Pil', pil ? `%${kacir(pil.percentage)} ${pil.status === 'CHARGING' ? '⚡' : ''} ${pil.temperature ? kacir(pil.temperature) + '°C' : ''}` : '—') +
      rozet('Bugün', maliyet ? `${kacir(maliyet.token)} token · ${kacir(maliyet.maliyetTL)} TL` : '—') +
      rozet('LLM', kacir(d.llm.model)) +
      rozet('Kulak / Ağız', `${kacir(d.llm.stt)} / ${kacir(d.llm.tts)}`) +
      rozet('Çalışma', `${Math.floor(d.calismaSuresi / 3600)}s ${Math.floor((d.calismaSuresi % 3600) / 60)}dk`) +
      rozet('Bellek', `${kacir(d.bellek.rssMB)} MB / boş ${kacir(d.bellek.bosMB)} MB`);
    $('#agBilgi').textContent = 'Ağ: ' + (d.ag || []).map((a) => `${a.ip} (${a.arayuz})`).join(', ');
  } catch (h) {
    $('#durum').innerHTML = `<div class="rozet hata">${h.message}</div>`;
  }
}

async function gorevleriYukle() {
  const { gorevler } = await api('/gorevler');
  if (!gorevler.length) {
    $('#gorevler').innerHTML = '<p class="soluk">Henüz görev yok.</p>';
    return;
  }
  $('#gorevler').innerHTML = gorevler
    .map((g) => {
      const liste = (d) => (Array.isArray(d) && d.length ? `<ul>${d.map((x) => `<li>${kacir(x)}</li>`).join('')}</ul>` : '');
      const eksik = g.eksik_bilgi?.length ? `<p class="hata">Eksik bilgi: ${kacir(g.eksik_bilgi.join(', '))}</p>` : '';
      const sonuc = g.sonuc ? `<p><b>Sonuç:</b> ${g.sonuc.basarili ? '✅' : '❌'} ${kacir(g.sonuc.ozet || '')}</p>${liste(g.sonuc.takip)}` : '';
      const aranabilir = ['hazir', 'taslak'].includes(g.durum);
      const iptalEdilebilir = ['hazir', 'taslak', 'araniyor'].includes(g.durum);
      return `<div class="gorev" data-id="${kacir(g.id)}">
        <div class="ust"><strong>${kacir(g.baslik || g.talimat)}</strong><span class="durum ${kacir(g.durum)}">${kacir(g.durum)}</span></div>
        <div class="soluk">${kacir(g.kisi?.ad || '?')} · ${kacir(g.kisi?.numara || 'numara yok')} · ${kacir(g.amac || '')}</div>
        ${liste(g.konusma_noktalari)}${eksik}${sonuc}
        <div class="eylemler">
          ${aranabilir ? `<a class="buton birincil" href="/telefon?gorev=${encodeURIComponent(g.id)}">📞 Tarayıcıdan görüş</a>` : ''}
          ${aranabilir && g.kisi?.numara ? `<button class="buton" data-eylem="voip">📳 VoIP'tan ara</button>` : ''}
          ${aranabilir && g.kisi?.numara ? `<button class="buton" data-eylem="hucresel">📱 Hattan çevir</button>` : ''}
          ${iptalEdilebilir ? `<button class="buton tehlike" data-eylem="iptal">İptal</button>` : ''}
          <button class="buton tehlike" data-eylem="sil">🗑 Kaydı sil</button>
        </div>
      </div>`;
    })
    .join('');
}

async function sohbetGonder(metin) {
  if (!metin?.trim()) return;
  $('#mesaj').value = '';
  balon('sen', metin);
  $('#gonder').disabled = true;
  const bekle = balon('sistem', 'düşünüyor…');
  try {
    const y = await api('/sohbet', { oturum: 'panel', metin, resimler: bekleyenGorsel ? [bekleyenGorsel] : [] });
    bekleyenGorsel = null;
    bekle.remove();
    adimNotu(y.adimlar);
    balon('asistan', y.metin || '(boş yanıt)');
    if (y.adimlar?.some((a) => a.arac === 'gorev_olustur')) gorevleriYukle();
    if (y.adimlar?.some((a) => a.arac === 'cebi_planla')) cebimonYukle();
    if (y.adimlar?.some((a) => a.arac === 'hatirla')) hafizaYukle();
  } catch (h) {
    bekle.textContent = 'Hata: ' + h.message;
    bekle.classList.add('hata');
  } finally { $('#gonder').disabled = false; }
}

$('#sohbetForm').addEventListener('submit', (e) => {
  e.preventDefault();
  sohbetGonder($('#mesaj').value.trim());
});

document.querySelectorAll('[data-hizli]').forEach((b) => b.addEventListener('click', () => sohbetGonder(b.dataset.hizli)));

// Yerleşik STT çalışmayan iOS/Brave benzeri tarayıcılarda MediaRecorder → sunucu STT yedeği.
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let tani;
let taniDinliyor = false;
let yedekKaydedici;
let yedekAkis;
let yedekZamanlayici;
let yedekParcalar = [];
let yedekBitiriyor = false;
async function yedekKaydiBaslat() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Bu tarayıcı mikrofon kaydını desteklemiyor.');
  yedekAkis = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported?.(m));
  try { yedekKaydedici = new MediaRecorder(yedekAkis, mime ? { mimeType: mime } : undefined); }
  catch (h) { yedekAkis.getTracks().forEach((t) => t.stop()); yedekAkis = null; throw new Error('Ses kaydı başlatılamadı: ' + h.message); }
  yedekParcalar = [];
  yedekBitiriyor = false;
  yedekKaydedici.ondataavailable = (e) => { if (e.data.size) yedekParcalar.push(e.data); };
  yedekKaydedici.onstop = async () => {
    clearTimeout(yedekZamanlayici);
    const blob = new Blob(yedekParcalar, { type: yedekKaydedici.mimeType || 'audio/webm' });
    yedekAkis?.getTracks().forEach((t) => t.stop());
    yedekAkis = null;
    $('#mikrofon').classList.remove('dinliyor');
    $('#mikrofon').textContent = '🎙';
    try {
      if (blob.size < 500) throw new Error('Ses çok kısa; tekrar deneyebilirsin.');
      $('#sesDurumu').textContent = 'Ses yazıya çevriliyor…';
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const { metin } = await api('/sese-yazi', { ses: btoa(binary), mime: blob.type.split(';')[0] || 'audio/webm' });
      if (!metin?.trim()) throw new Error('Konuşma anlaşılmadı.');
      $('#mesaj').value = metin;
      $('#sesDurumu').textContent = 'Konuşman yazıya çevrildi.';
      await sohbetGonder(metin);
    } catch (h) { $('#sesDurumu').textContent = h.message; }
  };
  yedekKaydedici.start();
  $('#mikrofon').classList.add('dinliyor');
  $('#mikrofon').textContent = '■';
  $('#sesDurumu').textContent = 'Kaydediyorum… Bitirmek için mikrofon düğmesine tekrar dokun (en çok 30 sn).';
  yedekZamanlayici = setTimeout(yedekKaydiDurdur, 30_000);
}
function yedekKaydiDurdur() {
  if (yedekKaydedici?.state === 'recording' && !yedekBitiriyor) {
    yedekBitiriyor = true;
    clearTimeout(yedekZamanlayici);
    yedekKaydedici.stop();
  }
}
if (SpeechRecognition) {
  tani = new SpeechRecognition();
  tani.lang = 'tr-TR'; tani.interimResults = false; tani.continuous = false;
  tani.onstart = () => { taniDinliyor = true; $('#mikrofon').classList.add('dinliyor'); $('#sesDurumu').textContent = 'Dinliyorum…'; };
  tani.onresult = (e) => { $('#mesaj').value = e.results[0][0].transcript; sohbetGonder(e.results[0][0].transcript); };
  tani.onerror = async (e) => {
    $('#mikrofon').classList.remove('dinliyor');
    if (e.error !== 'aborted') {
      try { $('#sesDurumu').textContent = 'Yerleşik tanıma kullanılamadı; mikrofon yedeği başlatılıyor…'; await yedekKaydiBaslat(); }
      catch (h) { $('#sesDurumu').textContent = `${h.message} İstersen yazıyla devam et.`; }
    }
  };
  tani.onend = () => { taniDinliyor = false; if (yedekKaydedici?.state !== 'recording') { $('#mikrofon').classList.remove('dinliyor'); $('#sesDurumu').textContent = 'Mikrofon düğmesine dokun, konuş; terminal gerekmez.'; } };
  $('#mikrofon').addEventListener('click', () => {
    if (yedekKaydedici?.state === 'recording') { yedekKaydiDurdur(); return; }
    if (taniDinliyor) { tani.stop(); return; }
    try { tani.start(); } catch { yedekKaydiBaslat().catch((h) => { $('#sesDurumu').textContent = h.message; }); }
  });
} else if (navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
  $('#mikrofon').addEventListener('click', () => {
    if (yedekKaydedici?.state === 'recording') yedekKaydiDurdur();
    else yedekKaydiBaslat().catch((h) => { $('#sesDurumu').textContent = h.message; });
  });
  $('#sesDurumu').textContent = 'Düğmeye dokunup konuş, bitirmek için tekrar dokun.';
} else {
  $('#mikrofon').disabled = true;
  $('#sesDurumu').textContent = 'Bu tarayıcı ses kaydını desteklemiyor; yazıyla devam edebilirsin.';
}

$('#bak').addEventListener('click', async () => {
  const bekle = balon('sistem', 'kameraya bakıyor…');
  try {
    const f = await api('/bak', { kamera: 0 });
    bekle.remove();
    bekleyenGorsel = `data:${f.mime};base64,${f.base64}`;
    balon('asistan', 'Şu an gördüğüm: (bir sonraki mesajın bu görselle birlikte yorumlanır)', bekleyenGorsel);
  } catch (h) {
    bekle.textContent = 'Hata: ' + h.message;
  }
});

$('#soyle').addEventListener('click', async () => {
  const metin = prompt('Telefonun hoparlöründen ne söylensin?');
  if (!metin) return;
  try {
    await api('/soyle', { metin });
    balon('sistem', `🔊 "${metin}" söylendi`);
  } catch (h) {
    balon('sistem', 'Hata: ' + h.message);
  }
});

$('#sifirla').addEventListener('click', async () => {
  await api('/sohbet/sifirla', { oturum: 'panel' });
  $('#sohbet').innerHTML = '';
  balon('sistem', 'sohbet sıfırlandı');
});

$('#cebiTemizle').addEventListener('click', async () => {
  if (!confirm('Cebimon görev oturumu ve geçmişi bu cihazdan silinsin mi?')) return;
  try {
    await api('/cebi/temizle', {});
    await cebimonYukle();
    bildir('Görev oturumu ve geçmiş temizlendi.');
  } catch (h) { bildir('Geçmiş temizlenemedi: ' + h.message, true); }
});

$('#cebiPlanForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const talimat = $('#cebiTalimat').value.trim();
  if (!talimat) return;
  const dugme = e.target.querySelector('button');
  dugme.disabled = true;
  try {
    await api('/cebi/planla', { talimat });
    $('#cebiTalimat').value = '';
    await cebimonYukle();
  } catch (h) { bildir('Görev planı oluşturulamadı: ' + h.message, true); }
  finally { dugme.disabled = false; }
});

let cebiAkis = null;
function cebiAkisiDurdur() {
  cebiAkis?.getTracks().forEach((t) => t.stop());
  cebiAkis = null;
  $('#cebiVideo').srcObject = null;
}
$('#cebiKapat').addEventListener('click', () => { cebiAkisiDurdur(); $('#cebiAdimDialog').close(); });
$('#cebiAdimDialog').addEventListener('close', cebiAkisiDurdur);

async function cebiAdimKaydiAc() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Kamera/mikrofon için HTTPS ve desteklenen tarayıcı gerekli.');
  const c = await api('/cebi');
  const adim = c.oturum?.adimlar?.find((a) => a.durum === 'aktif');
  if (!adim) throw new Error('Açık görev adımı bulunamadı.');
  cebiAkisiDurdur();
  cebiAkis = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 800 } }, audio: true });
  $('#cebiVideo').srcObject = cebiAkis;
  $('#cebiAdimMetni').textContent = adim.metin;
  $('#cebiKayitDurumu').textContent = 'Adımı yaptıktan sonra kısa sesli açıklama kaydı başlat.';
  $('#cebiAdimDialog').showModal();
  $('#cebiKaydet').onclick = async () => {
    const dugme = $('#cebiKaydet');
    dugme.disabled = true;
    $('#cebiKayitDurumu').textContent = 'Dinliyorum… Adımın sonucunu anlat.';
    try {
      const kaydedici = new MediaRecorder(new MediaStream(cebiAkis.getAudioTracks()));
      const parcaciklar = [];
      kaydedici.ondataavailable = (e) => { if (e.data.size) parcaciklar.push(e.data); };
      const bitis = new Promise((resolve, reject) => {
        kaydedici.onstop = () => resolve(new Blob(parcaciklar, { type: kaydedici.mimeType || 'audio/webm' }));
        kaydedici.onerror = () => reject(new Error('Ses kaydı alınamadı.'));
      });
      kaydedici.start();
      await new Promise((r) => setTimeout(r, 5000));
      if (kaydedici.state !== 'inactive') kaydedici.stop();
      const blob = await bitis;
      const video = $('#cebiVideo');
      if (!video.videoWidth) throw new Error('Kamera görüntüsü hazır değil.');
      const canvas = document.createElement('canvas');
      const oran = Math.min(1, 800 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * oran);
      canvas.height = Math.round(video.videoHeight * oran);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const gorsel = canvas.toDataURL('image/jpeg', 0.78);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      $('#cebiKayitDurumu').textContent = 'Cebimon görüntü ve sesi değerlendiriyor…';
      const sonuc = await api('/cebi/degerlendir', { gorsel, ses: btoa(binary), mime: blob.type || 'audio/webm' });
      cebiAkisiDurdur();
      $('#cebiAdimDialog').close();
      bildir(`${sonuc.onayGerekli ? 'Güvenlik nedeniyle onay gerekiyor.' : sonuc.adimTamamlandi ? 'Adım tamamlandı.' : 'Kanıt yetersiz; adım açık kaldı.'} ${sonuc.inceleme.geriBildirim || sonuc.inceleme.gozlem}`, !sonuc.adimTamamlandi);
      await cebimonYukle();
    } catch (h) {
      $('#cebiKayitDurumu').textContent = 'Hata: ' + h.message;
      dugme.disabled = false;
    }
  };
}

$('#cebiTahta').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-cebi-eylem]');
  if (!b) return;
  try {
    if (b.dataset.cebiEylem === 'incele') await cebiAdimKaydiAc();
    if (b.dataset.cebiEylem === 'onay' || b.dataset.cebiEylem === 'reddet') {
      await api('/cebi/onay', { onay: b.dataset.cebiEylem === 'onay' });
      await cebimonYukle();
    }
    if (b.dataset.cebiEylem === 'bitir') {
      await api('/cebi/bitir', { basarili: true, ozet: 'Görev adımları kamera ve mikrofon değerlendirmeleriyle tamamlandı.' });
      await cebimonYukle();
    }
  } catch (h) { bildir('Görev tahtası: ' + h.message, true); }
});

$('#gorevForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const talimat = $('#talimat').value.trim();
  if (!talimat) return;
  const numara = $('#numara').value.trim();
  const dugme = e.target.querySelector('button');
  dugme.disabled = true;
  dugme.textContent = 'Planlanıyor…';
  try {
    await api('/gorevler', { talimat, numara: numara || undefined });
    $('#talimat').value = '';
    $('#numara').value = '';
    await gorevleriYukle();
  } catch (h) {
    bildir('Hata: ' + h.message, true);
  } finally {
    dugme.disabled = false;
    dugme.textContent = 'Planla';
  }
});

$('#gorevler').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-eylem]');
  if (!b) return;
  const id = b.closest('.gorev').dataset.id;
  try {
    if (b.dataset.eylem === 'iptal') await api(`/gorevler/${id}`, { durum: 'iptal' });
    if (b.dataset.eylem === 'sil') {
      if (!confirm('Bu görev kaydı ve transkript kalıcı olarak silinecek. Devam?')) return;
      await api(`/gorevler/${id}/sil`, {});
    }
    if (b.dataset.eylem === 'voip') {
      if (!confirm('Asistan bu numarayı VoIP hattından arayacak ve kendi sesiyle konuşacak. Devam?')) return;
      const s = await api(`/gorevler/${id}/voip-ara`, {});
      bildir('Çağrı başlatıldı: ' + s.numara + (s.not ? ' — ' + s.not : ''));
    }
    if (b.dataset.eylem === 'hucresel') {
      if (!confirm('Eski telefonun hattından bu numara çevrilecek. Bu modda asistan konuşamaz; brifing burada gösterilir. Devam?')) return;
      const s = await api(`/gorevler/${id}/hucresel-ara`, {});
      bildir(`Çevriliyor: ${s.arandi}. Açılış: ${s.brifing.acilis || ''}. Konuşma noktaları: ${(s.brifing.konusma_noktalari || []).join('; ')}`);
    }
    await gorevleriYukle();
  } catch (h) {
    bildir('Hata: ' + h.message, true);
  }
});

async function hafizaYukle() {
  try {
    const { icerik } = await api('/hafiza');
    $('#hafiza').textContent = icerik || '(boş)';
  } catch (h) {
    $('#hafiza').textContent = h.message;
  }
}

$('#yenile').addEventListener('click', (e) => {
  e.preventDefault();
  durumYukle();
  gorevleriYukle();
  hafizaYukle();
});

// PWA: servis çalışanı + "Uygulama olarak kur" düğmesi
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
let kurulumIstemi = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  kurulumIstemi = e;
  $('#kur').style.display = '';
});
$('#kur').addEventListener('click', async () => {
  if (!kurulumIstemi) return;
  kurulumIstemi.prompt();
  await kurulumIstemi.userChoice.catch(() => {});
  kurulumIstemi = null;
  $('#kur').style.display = 'none';
});
window.addEventListener('appinstalled', () => balon('sistem', 'Uygulama ana ekrana kuruldu ✓'));

durumYukle();
cebimonYukle();
gorevleriYukle();
hafizaYukle();
setInterval(() => { durumYukle(); cebimonYukle(); }, 60_000);
