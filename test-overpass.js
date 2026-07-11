const https = require('https');

function fetchOverpass(lat, lng) {
  const query = `[out:json];is_in(${lat},${lng})->.a;area.a[boundary=administrative][admin_level~"^[6789]$"];out tags;`;
  const options = {
    hostname: 'overpass-api.de',
    path: '/api/interpreter',
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'BaseraIndiaMap/1.0 (Contact: admin@example.com)'
    }
  };
  const req = https.request(options, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      console.log(`[${lat}, ${lng}]:`);
      try {
        const json = JSON.parse(data);
        json.elements.forEach(el => console.log(`  AdminLevel: ${el.tags.admin_level}, Name: ${el.tags.name}, Name(en): ${el.tags['name:en']}`));
      } catch(e) { console.log(data); }
    });
  });
  req.write(`data=${encodeURIComponent(query)}`);
  req.end();
}

fetchOverpass(18.5204, 73.8567);
