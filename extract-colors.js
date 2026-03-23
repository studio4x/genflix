const https = require('https');

https.get('https://www.homecarematch.com.br', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    // Find stylesheets link
    const regex = /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g;
    let match;
    const stylesheets = [];
    while ((match = regex.exec(data)) !== null) {
      stylesheets.push(match[1]);
    }
    
    // Also just match any hex color in the HTML itself
    const hexRegex = /#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\b/g;
    const colors = {};
    while ((match = hexRegex.exec(data)) !== null) {
      colors[match[0].toLowerCase()] = (colors[match[0].toLowerCase()] || 0) + 1;
    }
    
    console.log("Colors in HTML:", Object.entries(colors).sort((a,b) => b[1] - a[1]).slice(0, 10));
    console.log("Stylesheets found:", stylesheets);
  });
}).on('error', (e) => {
  console.error("Error:", e.message);
});
