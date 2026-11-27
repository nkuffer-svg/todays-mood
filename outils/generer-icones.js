// Régénère les icônes PNG à partir des SVG : node outils/generer-icones.js (Playwright requis).
const fs = require('fs');
const { chromium } = require('playwright');
const D = require("path").join(__dirname, "..", "icons") + "/";

function cadran(k) { // k : échelle du cadran (1 = rayon extérieur 176 sur 512)
  const ticks = [];
  for (let i = 0; i <= 16; i++) {
    const a = -120 + i * 15, maj = i % 2 === 0;
    ticks.push(`<line y1="-132" y2="${maj ? -108 : -118}" stroke-width="${maj ? 9 : 4}" transform="rotate(${a})"/>`);
  }
  return `<g transform="translate(256 256) scale(${k})">
  <circle r="176" fill="#7A5C2C"/>
  <circle r="170" fill="#8C6B34"/>
  <circle r="162" fill="#C9A15B"/>
  <circle r="150" fill="#E0BC7A" opacity="0.35"/>
  <circle r="146" fill="#EFE6D2"/>
  <g stroke="#2A2118" stroke-linecap="round">${ticks.join('')}</g>
  <g transform="rotate(38)"><path d="M -8 26 L -2.2 -124 L 2.2 -124 L 8 26 Z" fill="#B23A2A"/></g>
  <circle r="20" fill="#2A2118"/><circle r="20" fill="none" stroke="#C9A15B" stroke-width="5"/><circle r="5" fill="#C9A15B"/>
</g>`;
}
const svgIcone = (k) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#17130F"/>
  ${cadran(k)}
</svg>
`;
fs.writeFileSync(D + 'icon.svg', svgIcone(1.25));
fs.writeFileSync(D + 'icon-maskable.svg', svgIcone(0.98));

const TRACES = {
  eau: '<path d="M12 3.2c-2.9 3.6-6 7.4-6 10.9a6 6 0 0 0 12 0c0-3.5-3.1-7.3-6-10.9z"/><path d="M9 14.6a3 3 0 0 0 2.6 2.8"/>',
  cafe: '<path d="M5 10h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11.5h1.5a2.3 2.3 0 0 1 0 4.6H15.6"/><path d="M8.5 3.8c0 1.4-1 1.6-1 3M11.5 3.8c0 1.4-1 1.6-1 3M14.5 3.8c0 1.4-1 1.6-1 3"/>',
  guitare: '<path d="M12 21c-3.6-3-7-7.9-7-11.8C5 6 8.3 4 12 4s7 2 7 5.2C19 13.1 15.6 18 12 21z"/>',
};
const svgRaccourci = (nom) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" fill="#C9A15B"/>
  <circle cx="48" cy="48" r="40" fill="none" stroke="#8C6B34" stroke-width="2"/>
  <g transform="translate(19 19) scale(2.42)" fill="none" stroke="#17130F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${TRACES[nom]}</g>
</svg>
`;
for (const n of Object.keys(TRACES)) fs.writeFileSync(D + `raccourci-${n}.svg`, svgRaccourci(n));

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const rendu = async (src, taille, dest) => {
    await p.setViewportSize({ width: taille, height: taille });
    await p.setContent(`<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(D + src)).toString('base64')}" width="${taille}" height="${taille}" style="display:block"></body></html>`);
    await p.screenshot({ path: D + dest, omitBackground: true });
  };
  await rendu('icon.svg', 192, 'icon-192.png');
  await rendu('icon.svg', 512, 'icon-512.png');
  await rendu('icon-maskable.svg', 512, 'icon-maskable-512.png');
  for (const n of Object.keys(TRACES)) await rendu(`raccourci-${n}.svg`, 192, `raccourci-${n}-192.png`);
  await b.close();
})();
