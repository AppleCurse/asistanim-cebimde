const queries = ['Haluk', 'Haluk Bilginer', 'haluk baba'];

for (const q of queries) {
  try {
    const res = await fetch(`https://api.fish.audio/model?title=${encodeURIComponent(q)}`);
    console.log(`Query "${q}" status:`, res.status);
    if (res.ok) {
      const data = await res.json();
      console.log(`Results for "${q}":`, (data.items || []).map(i => ({ id: i._id || i.id, title: i.title, desc: i.description })));
    }
  } catch (e) {
    console.error(e.message);
  }
}
