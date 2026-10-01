import net from 'node:net';

const komut = process.argv[2] || 'reginfo';
const parametre = process.argv[3];

const s = net.connect(4444, '127.0.0.1', () => {
  const payload = { command: komut };
  if (parametre) payload.params = parametre;
  const str = JSON.stringify(payload);
  const msg = `${str.length}:${str},`;
  console.log('Gönderiliyor:', msg);
  s.write(msg);
});

s.on('data', (d) => {
  console.log('Baresip yanıtı:\n', d.toString('utf8'));
  s.destroy();
});

s.on('error', (err) => {
  console.error('Hata:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('Zaman aşımı');
  s.destroy();
  process.exit(0);
}, 5000);
