const queries = ['Sedat Peker', 'Sedat', 'Peker', 'Tayyip', 'Erdoğan'];

for (const q of queries) {
  try {
    const res = await fetch(`https://api.fish.audio/model?title=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`=== Results for "${q}" ===`);
      for (const i of (data.items || [])) {
        console.log(`- ID: ${i._id || i.id} | Title: ${i.title} | Desc: ${i.description || ''}`);
      }
    } else {
      console.log(`Query "${q}" error:`, res.status);
    }
  } catch (e) {
    console.error(e.message);
  }
}
