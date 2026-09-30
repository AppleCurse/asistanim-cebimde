// Panel — cebindeki telefondan asistanı yönetme ekranı.
const $ = (s) => document.querySelector(s);

// LLM/kullanıcı metnini innerHTML'e gömerken HTML kaçışı (XSS sertleştirmesi)
const kacir = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// /bak ile çekilen son görsel: bir sonraki sohbet mesajına eklenir ("bu ne?" diye sorabilmek için)
let bekleyenGorsel = null;

async function api(yol, govde) {
  const y = await fetch('/api' + yol, {
    method: govde ? 'POST' : 'GET',
    headers: govde ? { 'Content-Type': 'application/json' } : {},
    body: govde ? JSON.stringify(govde) : undefined,
  });
  const veri = await y.json().catch(() => ({}));
  if (!y.ok) throw new Error(veri.hata || y.statusText);
  return veri;
}

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

// Telefonun yerleşik Türkçe konuşma tanıması: sunucuya ses göndermeden, terminal olmadan çalışır.
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const tani = new SpeechRecognition();
  tani.lang = 'tr-TR'; tani.interimResults = false; tani.continuous = false;
  tani.onstart = () => { $('#mikrofon').classList.add('dinliyor'); $('#sesDurumu').textContent = 'Dinliyorum…'; };
  tani.onresult = (e) => { $('#mesaj').value = e.results[0][0].transcript; sohbetGonder(e.results[0][0].transcript); };
  tani.onerror = () => { $('#sesDurumu').textContent = 'Ses alınamadı. İstersen yazabilirsin.'; };
  tani.onend = () => { $('#mikrofon').classList.remove('dinliyor'); $('#sesDurumu').textContent = 'Mikrofon düğmesine dokun, konuş; terminal gerekmez.'; };
  $('#mikrofon').addEventListener('click', () => tani.start());
} else {
  $('#mikrofon').disabled = true;
  $('#sesDurumu').textContent = 'Bu tarayıcı sesli yazmayı desteklemiyor; yazıyla devam edebilirsin.';
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
    alert('Hata: ' + h.message);
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
      alert('Çağrı başlatıldı: ' + s.numara + (s.not ? '\n\n' + s.not : ''));
    }
    if (b.dataset.eylem === 'hucresel') {
      if (!confirm('Eski telefonun hattından bu numara çevrilecek. Bu modda asistan konuşamaz; brifing burada gösterilir. Devam?')) return;
      const s = await api(`/gorevler/${id}/hucresel-ara`, {});
      alert(`Çevriliyor: ${s.arandi}\n\nAçılış: ${s.brifing.acilis || ''}\n\nNoktalar:\n- ${(s.brifing.konusma_noktalari || []).join('\n- ')}`);
    }
    await gorevleriYukle();
  } catch (h) {
    alert('Hata: ' + h.message);
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
gorevleriYukle();
hafizaYukle();
setInterval(durumYukle, 60_000);
