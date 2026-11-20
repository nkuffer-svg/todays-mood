/* Totaux calculés (jamais stockés) : jour, mois et depuis le début, à partir des fiches et des marches locales. */

const BOISSONS = ['cafe', 'deca', 'biere', 'vin'];

function vide() {
  return { cafe: 0, deca: 0, biere: 0, vin: 0, eau_ml: 0, natation_m: 0, natation_nb: 0, marche_km: 0, marche_nb: 0 };
}

const nombre = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Totaux du mois de `date` et depuis le début, plus les marches de ce jour. */
export async function calculerTotaux(date) {
  const [fiches, marches] = await Promise.all([TMDB.tout('fiches'), TMDB.tout('marches')]);
  const prefixeMois = date.slice(0, 7);
  const mois = vide();
  const total = vide();

  for (const f of fiches) {
    const cibles = f.date.startsWith(prefixeMois) ? [mois, total] : [total];
    for (const c of cibles) {
      for (const k of BOISSONS) c[k] += nombre(f[k]);
      c.eau_ml += nombre(f.eau_ml);
      if (nombre(f.natation_m) > 0) {
        c.natation_m += nombre(f.natation_m);
        c.natation_nb += 1;
      }
    }
  }
  for (const m of marches) {
    const cibles = m.date.startsWith(prefixeMois) ? [mois, total] : [total];
    for (const c of cibles) {
      c.marche_km += nombre(m.km);
      c.marche_nb += 1;
    }
  }
  for (const c of [mois, total]) c.marche_km = Math.round(c.marche_km * 100) / 100;

  const marchesDuJour = marches.filter((m) => m.date === date).sort((a, b) => (a.id < b.id ? -1 : 1));
  const jour = { marche_km: Math.round(marchesDuJour.reduce((s, m) => s + nombre(m.km), 0) * 100) / 100 };
  return { jour, mois, total, marchesDuJour };
}
