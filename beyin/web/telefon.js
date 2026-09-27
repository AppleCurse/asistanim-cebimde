// Yazılım telefonu — asistanla (veya asistanın bir görevini test etmek için) sesli görüşme.
// İki ses yolu:
//  - tarayici-ses: STT = Web Speech API (SpeechRecognition), TTS = speechSynthesis. Sunucuya metin gider.
//  - sunucu-ses : mikrofon MediaRecorder ile kaydedilir → ikili WS çerçevesi → 9router STT; yanıt mp3 gelir.
const $ = (s) => document.querySelector(s);
const guvenli = window.isSecureContext;
const Tanima = window.SpeechRecognition || window.webkitSpeechRecognition;

let ws = null;
let mod = 'tarayici-ses';
let aktif = false;
let baslangic = 0;
let sureZamanlayici = null;
let tanima = null;
let tanimaIstenen = false;
let konusuyor = false;
let kaydedici = null;
let parcalar = [];
let beklenenSesMime = null;
let sesKuyrugu = [];
let calan = null;

function satir(rol, metin) {
  const d = document.createElement('div');
  d.className = 'balon ' + (rol === 'asistan' ? 'asistan' : rol === 'karsi' ? 'karsi' : 'sistem');
  d.textContent = metin;
  $('#transkript').appendChild(d);
  $('#transkript').scrollTop = $('#transkript').scrollHeight;
}

function asama(m) {
  $('#asama').textContent = m;
}

function sureGuncelle() {
  const s = Math.floor((Date.now() - baslangic) / 1000);
  $('#sure').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- TTS (tarayıcı) ----------
function tarayiciSeslendir(metin) {
  return new Promise((coz) => {
    if (!('speechSynthesis' in window)) return coz();
    tanimayiDurdur();
    konusuyor = true;
    const u = new SpeechSynthesisUtterance(metin);
    u.lang = 'tr-TR';
    const sesler = speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('tr'));
    if (sesler.length) u.voice = sesler.find((v) => /google|natural|premium/i.test(v.name)) || sesler[0];
    u.onend = u.onerror = () => {
      konusuyor = false;
      if (tanimaIstenen) tanimayiBaslat();
      coz();
    };
    speechSynthesis.speak(u);
  });
}

// ---------- STT (tarayıcı) ----------
function tanimayiBaslat() {
  if (!Tanima || tanima || konusuyor || !aktif) return;
  tanima = new Tanima();
  tanima.lang = 'tr-TR';
  tanima.continuous = true;
  tanima.interimResults = true;
  let araMetin = '';
  tanima.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        const m = r[0].transcript.trim();
        if (m) gonder({ tip: 'metin', metin: m });
        araMetin = '';
      } else araMetin = r[0].transcript;
    }
    asama(araMetin ? `duyuyor: ${araMetin}` : 'dinliyor');
  };
  tanima.onerror = (e) => {
    if (e.error === 'not-allowed') $('#uyari').textContent = 'Mikrofon izni reddedildi. HTTPS gerekir veya chrome://flags → "Insecure origins treated as secure" listesine bu adresi ekleyin.';
  };
  tanima.onend = () => {
    tanima = null;
    if (tanimaIstenen && aktif && !konusuyor) setTimeout(tanimayiBaslat, 250);
  };
  try {
    tanima.start();
    asama('dinliyor');
  } catch {
    tanima = null;
  }
}

function tanimayiDurdur() {
  if (tanima) {
    const t = tanima;
    tanima = null;
    try {
      t.onend = null;
      t.stop();
    } catch {
      /* boş */
    }
  }
}

// ---------- Mikrofon kaydı (sunucu sesi) ----------
async function kaydaBasla() {
  if (!navigator.mediaDevices?.getUserMedia) {
    $('#uyari').textContent = 'Mikrofon API yok. HTTPS gerekir (docs/kurulum.md → "Mikrofon ve HTTPS").';
    return;
  }
  try {
    const akis = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
    kaydedici = new MediaRecorder(akis, mime ? { mimeType: mime } : undefined);
    parcalar = [];
    kaydedici.ondataavailable = (e) => e.data.size && parcalar.push(e.data);
    kaydedici.onstop = async () => {
      akis.getTracks().forEach((t) => t.stop());
      const blob = new Blob(parcalar, { type: kaydedici.mimeType || 'audio/webm' });
      if (blob.size < 1500) return asama('çok kısa, tekrar dene');
      gonder({ tip: 'ses', mime: blob.type });
      ws.send(await blob.arrayBuffer());
      asama('gönderildi, yazıya çevriliyor…');
    };
    kaydedici.start();
    sesiDurdur(); // barge-in
    $('#basKonus').classList.add('kayit');
    asama('kaydediyor…');
  } catch (h) {
    $('#uyari').textContent = 'Mikrofon açılamadı: ' + h.message;
  }
}

function kaydiBitir() {
  if (kaydedici && kaydedici.state !== 'inactive') kaydedici.stop();
  $('#basKonus').classList.remove('kayit');
}

// ---------- Sunucu sesi çalma ----------
function sesiDurdur() {
  sesKuyrugu = [];
  if (calan) {
    calan.pause();
    calan = null;
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function sesKuyrugaEkle(blob) {
  sesKuyrugu.push(blob);
  if (!calan) siradakiniCal();
}

function siradakiniCal() {
  const blob = sesKuyrugu.shift();
  if (!blob) {
    calan = null;
    asama('dinliyor');
    return;
  }
  calan = new Audio(URL.createObjectURL(blob));
  asama('konuşuyor');
  calan.onended = calan.onerror = siradakiniCal;
  calan.play().catch(siradakiniCal);
}

// ---------- WebSocket ----------
function gonder(nesne) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(nesne));
}

function baglan(gorevId) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws/telefon`);
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => {
    gonder({ tip: 'baslat', gorevId: gorevId || undefined, mod });
    $('#nabiz').classList.add('yasiyor');
  };
  ws.onclose = () => {
    $('#nabiz').classList.remove('yasiyor');
    if (aktif) gorusmeBitti('bağlantı koptu');
  };
  ws.onmessage = async (e) => {
    if (e.data instanceof ArrayBuffer) {
      sesKuyrugaEkle(new Blob([e.data], { type: beklenenSesMime || 'audio/mpeg' }));
      beklenenSesMime = null;
      return;
    }
    const m = JSON.parse(e.data);
    switch (m.tip) {
      case 'hazir':
        aktif = true;
        baslangic = Date.now();
        sureZamanlayici = setInterval(sureGuncelle, 1000);
        $('#baslat').disabled = true;
        $('#bitir').disabled = false;
        $('#basKonus').disabled = false;
        $('#ozetKart').style.display = 'none';
        satir('sistem', m.gorev ? `Görev #${m.gorev.id}: ${m.gorev.baslik}` : 'Serbest sohbet başladı');
        if (mod === 'tarayici-ses' && $('#surekli').checked) {
          tanimaIstenen = true;
          tanimayiBaslat();
        }
        break;
      case 'metin':
        satir(m.rol, m.metin);
        if (m.rol === 'asistan' && !m.sesGelecek && mod === 'tarayici-ses') await tarayiciSeslendir(m.metin);
        break;
      case 'ses':
        beklenenSesMime = m.mime;
        break;
      case 'sesDurdur':
        sesiDurdur();
        break;
      case 'durum':
        asama({ dusunuyor: 'düşünüyor…', konusuyor: 'konuşuyor', dinliyor: 'yazıya çevriliyor…', bekliyor: m.mesaj || 'bekliyor', kapaniyor: 'kapanıyor…', hata: 'hata: ' + (m.mesaj || '') }[m.asama] || m.asama);
        break;
      case 'bitti':
        gorusmeBitti(m.sebep, m);
        break;
      case 'hata':
        satir('sistem', 'Hata: ' + m.mesaj);
        break;
    }
  };
}

function gorusmeBitti(sebep, m = {}) {
  aktif = false;
  tanimaIstenen = false;
  tanimayiDurdur();
  sesiDurdur();
  clearInterval(sureZamanlayici);
  $('#baslat').disabled = false;
  $('#bitir').disabled = true;
  $('#basKonus').disabled = true;
  asama('görüşme bitti (' + sebep + ')');
  if (m.gorev?.sonuc) {
    const s = m.gorev.sonuc;
    $('#ozetKart').style.display = '';
    $('#ozet').innerHTML = `<p>${s.basarili ? '✅ Başarılı' : '❌ Başarısız'} — ${s.ozet || ''}</p>
      ${s.kararlar?.length ? '<p><b>Kararlar:</b></p><ul>' + s.kararlar.map((k) => `<li>${k}</li>`).join('') + '</ul>' : ''}
      ${s.takip?.length ? '<p><b>Takip:</b></p><ul>' + s.takip.map((k) => `<li>${k}</li>`).join('') + '</ul>' : ''}`;
  }
  if (ws && ws.readyState === 1) ws.close();
}

// ---------- UI ----------
async function gorevleriDoldur() {
  try {
    const y = await fetch('/api/gorevler');
    const { gorevler } = await y.json();
    const sec = $('#gorev');
    for (const g of gorevler.filter((g) => ['hazir', 'taslak', 'araniyor'].includes(g.durum))) {
      const o = document.createElement('option');
      o.value = g.id;
      o.textContent = `#${g.id} · ${g.baslik} (${g.kisi?.ad || '?'})`;
      sec.appendChild(o);
    }
    const istenen = new URLSearchParams(location.search).get('gorev');
    if (istenen) sec.value = istenen;
  } catch {
    /* boş */
  }
}

$('#baslat').addEventListener('click', () => {
  mod = $('#mod').value;
  $('#transkript').innerHTML = '';
  $('#uyari').textContent = '';
  if (mod === 'tarayici-ses' && !Tanima) $('#uyari').textContent = 'Bu tarayıcıda konuşma tanıma yok (Android Chrome önerilir). Yazarak devam edebilirsin; yanıtlar yine seslendirilir.';
  if (!guvenli) $('#uyari').textContent += ' Sayfa HTTPS değil: mikrofon çalışmayabilir (bkz. docs/kurulum.md → Mikrofon ve HTTPS).';
  if ('speechSynthesis' in window) speechSynthesis.getVoices(); // sesleri önceden yükle
  baglan($('#gorev').value);
});

$('#bitir').addEventListener('click', () => gonder({ tip: 'bitir' }));

$('#surekli').addEventListener('change', (e) => {
  tanimaIstenen = e.target.checked && mod === 'tarayici-ses';
  if (tanimaIstenen && aktif) tanimayiBaslat();
  else tanimayiDurdur();
});

const bk = $('#basKonus');
const basla = (e) => {
  e.preventDefault();
  if (!aktif) return;
  if (mod === 'sunucu-ses') kaydaBasla();
  else {
    sesiDurdur();
    tanimaIstenen = true;
    tanimayiBaslat();
    bk.classList.add('kayit');
  }
};
const birak = (e) => {
  e.preventDefault();
  if (mod === 'sunucu-ses') kaydiBitir();
  else {
    if (!$('#surekli').checked) {
      tanimaIstenen = false;
      // son sonucun gelmesi için kısa gecikmeyle durdur
      setTimeout(() => {
        if (!tanimaIstenen) tanimayiDurdur();
      }, 600);
    }
    bk.classList.remove('kayit');
  }
};
bk.addEventListener('pointerdown', basla);
bk.addEventListener('pointerup', birak);
bk.addEventListener('pointercancel', birak);
bk.addEventListener('pointerleave', birak);

$('#metinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const m = $('#metin').value.trim();
  if (!m || !aktif) return;
  $('#metin').value = '';
  gonder({ tip: 'metin', metin: m });
});

gorevleriDoldur();
