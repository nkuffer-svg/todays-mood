/* Petit générateur de fichiers Word (.docx), sans bibliothèque externe.
   Un .docx est une archive ZIP contenant quelques fichiers XML ; on l'écrit ici « sans compression »
   (méthode STORE), ce que Word, OneNote et LibreOffice lisent sans problème. */

/* ---------- ZIP (méthode STORE) ---------- */

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(octets) {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dateDos(d) {
  const heure = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const jour = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { heure, jour };
}

/** fichiers : [{ nom, contenu (texte) }] → Uint8Array de l'archive */
function zip(fichiers) {
  const enc = new TextEncoder();
  const { heure, jour } = dateDos(new Date());
  const morceaux = [];
  const central = [];
  let decalage = 0;

  for (const f of fichiers) {
    const nom = enc.encode(f.nom);
    const donnees = enc.encode(f.contenu);
    const crc = crc32(donnees);

    const entete = new DataView(new ArrayBuffer(30));
    entete.setUint32(0, 0x04034b50, true);
    entete.setUint16(4, 20, true);
    entete.setUint16(6, 0x0800, true); // noms en UTF-8
    entete.setUint16(8, 0, true); // STORE
    entete.setUint16(10, heure, true);
    entete.setUint16(12, jour, true);
    entete.setUint32(14, crc, true);
    entete.setUint32(18, donnees.length, true);
    entete.setUint32(22, donnees.length, true);
    entete.setUint16(26, nom.length, true);
    entete.setUint16(28, 0, true);
    morceaux.push(new Uint8Array(entete.buffer), nom, donnees);

    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, heure, true);
    c.setUint16(14, jour, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, donnees.length, true);
    c.setUint32(24, donnees.length, true);
    c.setUint16(28, nom.length, true);
    c.setUint32(42, decalage, true);
    central.push(new Uint8Array(c.buffer), nom);

    decalage += 30 + nom.length + donnees.length;
  }

  const tailleCentral = central.reduce((s, m) => s + m.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, fichiers.length, true);
  fin.setUint16(10, fichiers.length, true);
  fin.setUint32(12, tailleCentral, true);
  fin.setUint32(16, decalage, true);

  const tout = [...morceaux, ...central, new Uint8Array(fin.buffer)];
  const sortie = new Uint8Array(tout.reduce((s, m) => s + m.length, 0));
  let i = 0;
  for (const m of tout) { sortie.set(m, i); i += m.length; }
  return sortie;
}

/* ---------- WordprocessingML ---------- */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function echapper(texte) {
  return String(texte)
    // caractères interdits en XML (sauf tabulation et retours à la ligne)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function paragraphe(texte, style, centre = false) {
  const pPr = style || centre ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${centre ? '<w:jc w:val="center"/>' : ''}</w:pPr>` : '';
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${echapper(texte)}</w:t></w:r></w:p>`;
}

const SAUT_DE_PAGE = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

/** Tableau « garage » : en-tête sombre à texte crème, filets laiton. */
function tableau(entete, lignes) {
  const n = Math.max(entete?.length || 0, ...lignes.map((l) => l.length));
  const largeur = Math.floor(9638 / n);
  const cellule = (texte, tete) => `<w:tc><w:tcPr><w:tcW w:w="${largeur}" w:type="dxa"/>${tete ? '<w:shd w:val="clear" w:color="auto" w:fill="221C16"/>' : ''}</w:tcPr>`
    + `<w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r>${tete ? '<w:rPr><w:b/><w:color w:val="EFE6D2"/></w:rPr>' : ''}<w:t xml:space="preserve">${echapper(texte ?? '')}</w:t></w:r></w:p></w:tc>`;
  const ligne = (cells, tete) => `<w:tr>${Array.from({ length: n }, (_, i) => cellule(cells[i], tete)).join('')}</w:tr>`;
  const bord = (nom) => `<w:${nom} w:val="single" w:sz="4" w:space="0" w:color="C9A15B"/>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(bord).join('')}</w:tblBorders>`
    + `<w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>`
    + `<w:tblGrid>${Array.from({ length: n }, () => `<w:gridCol w:w="${largeur}"/>`).join('')}</w:tblGrid>`
    + (entete ? ligne(entete, true) : '') + lignes.map((l) => ligne(l, false)).join('') + '</w:tbl>'
    + '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>';
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="fr-CH"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:color w:val="8C6B34"/><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="60"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="8C6B34"/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="40"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="2A2118"/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Couverture"><w:name w:val="Couverture"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:before="2400" w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Bebas Neue" w:hAnsi="Bebas Neue"/><w:b/><w:caps/><w:spacing w:val="40"/><w:color w:val="8C6B34"/><w:sz w:val="72"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Annee"><w:name w:val="Annee"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="480"/></w:pPr><w:rPr><w:rFonts w:ascii="Bebas Neue" w:hAnsi="Bebas Neue"/><w:b/><w:color w:val="B23A2A"/><w:sz w:val="120"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Meta"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="160"/></w:pPr><w:rPr><w:i/><w:color w:val="6B5A44"/><w:sz w:val="20"/></w:rPr></w:style>
</w:styles>`;

/**
 * Crée un .docx.
 * @param {{ type: 'titre'|'titre1'|'titre2'|'meta'|'texte'|'couverture'|'annee'|'saut'|'tableau', texte?: string, centre?: boolean, entete?: string[], lignes?: string[][] }[]} blocs
 *   « texte » peut contenir des retours à la ligne : chaque ligne devient un paragraphe.
 * @returns {Blob}
 */
export function creerDocx(blocs) {
  const corps = [];
  for (const b of blocs) {
    if (b.type === 'titre') corps.push(paragraphe(b.texte, 'Title'));
    else if (b.type === 'titre1') corps.push(paragraphe(b.texte, 'Heading1'));
    else if (b.type === 'titre2') corps.push(paragraphe(b.texte, 'Heading2'));
    else if (b.type === 'couverture') corps.push(paragraphe(b.texte, 'Couverture'));
    else if (b.type === 'annee') corps.push(paragraphe(b.texte, 'Annee'));
    else if (b.type === 'saut') corps.push(SAUT_DE_PAGE);
    else if (b.type === 'tableau') corps.push(tableau(b.entete, b.lignes || []));
    else if (b.type === 'meta') corps.push(paragraphe(b.texte, 'Meta', b.centre));
    else if (b.centre) corps.push(paragraphe(b.texte, null, true));
    else for (const ligne of String(b.texte).split(/\r?\n/)) corps.push(paragraphe(ligne));
  }
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}"><w:body>${corps.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const octets = zip([
    { nom: '[Content_Types].xml', contenu: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
    { nom: '_rels/.rels', contenu: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { nom: 'word/_rels/document.xml.rels', contenu: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { nom: 'word/document.xml', contenu: document },
    { nom: 'word/styles.xml', contenu: STYLES },
  ]);
  return new Blob([octets], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
