import net from 'node:net';

const s = net.connect(4444, '127.0.0.1', () => {
  console.log('CONNECTED_4444');
  s.destroy();
  process.exit(0);
});

s.on('error', (e) => {
  console.log('ERR_4444:', e.message);
  process.exit(1);
});
