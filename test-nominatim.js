const https = require('https');

function fetchNominatim(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1&polygon_geojson=1`;
  https.get(url, { headers: { 'User-Agent': 'Basera/1.0' } }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const json = JSON.parse(data);
      console.log(`[${lat}, ${lng}] -> Type: ${json.type}, Name: ${json.name}, Address:`, Object.keys(json.address).map(k => `${k}: ${json.address[k]}`).join(' | '));
      console.log(`Has Polygon: ${!!json.geojson}\n`);
    });
  });
}

// Mumbai
fetchNominatim(19.076, 72.8777);
// Pune
fetchNominatim(18.5204, 73.8567);
// Rural Maharashtra (Ralegan Siddhi area)
fetchNominatim(18.995, 74.264);

