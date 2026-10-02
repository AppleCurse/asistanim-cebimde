import net from 'node:net';

function dial(uri) {
  return new Promise((resolve) => {
    const s = net.connect(4444, '127.0.0.1', () => {
      console.log(`[DIAL TEST] Çevriliyor: ${uri}`);
      const cmd = JSON.stringify({ command: 'dial', params: uri });
      s.write(`${cmd.length}:${cmd},`);
    });
    s.on('data', (d) => {
      console.log(`[BARESIP YANIT] ${d.toString()}`);
    });
    setTimeout(() => {
      s.destroy();
      resolve();
    }, 6000);
  });
}

const target = process.argv[2] || 'sip:00905342009044@pbx.zadarma.com';
await dial(target);
