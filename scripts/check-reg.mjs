import net from 'node:net';

const s = net.connect(4444, '127.0.0.1', () => {
  const cmd = JSON.stringify({ command: 'reginfo' });
  s.write(`${cmd.length}:${cmd},`);
});

s.on('data', (d) => {
  console.log('[REGINFO]', d.toString());
  s.destroy();
});

setTimeout(() => {
  s.destroy();
  process.exit(0);
}, 3000);
