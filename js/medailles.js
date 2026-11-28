/* Les médailles du garage (version 5 B) : calculées depuis les données, y compris rétroactivement.
   Chaque médaille donne sa progression (valeur / cible) et la date à laquelle elle a été (ou serait) obtenue.
   Les médailles obtenues sont enregistrées (magasin « medailles », onglet « Medailles » du Sheet : id, date)
   pour garder leur date même si les données changent ensuite. */
import { decaler } from './jour.js';
import { ventDe, estBise } from './meteo.js';
import { lune, nomPhase } from './astro.js';
import { minutesDe } from './durees.js';
import { bornesMois } from './defis.js';

const n = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v));
const parDateCroissante = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** Cumul de points datés : valeur atteinte et date du franchissement de la cible. */
function cumul(points, cible) {
  let s = 0;
  let date = null;
  for (const p of [...points].sort(parDateCroissante)) {
    s += p.v;
    if (!date && s >= cible) date = p.date;
  }
  return { valeur: s, date };
}

/** Plus longue série de jours consécutifs (dates triées) et date à laquelle elle atteint la cible. */
function serie(dates, cible) {
  let meilleure = 0;
  let courante = 0;
  let precedente = null;
  let date = null;
  for (const d of [...new Set(dates)].sort()) {
    courante = precedente && d === decaler(precedente, 1) ? courante + 1 : 1;
    precedente = d;
    if (courante > meilleure) meilleure = courante;
    if (!date && courante >= cible) date = d;
  }
  return { valeur: meilleure, date };
}

/** Une seule occurrence suffit : 0 ou 1, avec la première date. */
function premiere(dates) {
  const d = [...dates].sort()[0];
  return { valeur: d ? 1 : 0, date: d || null };
}

const biseDuJour = (f) => [8, 16].some((h) => { const v = ventDe(f, h); return estBise(v.vent, v.dir); });

/**
 * La liste des médailles, chacune avec { id, nom, description, icone, secrete, cible, unite, valeur, date }.
 * @param {object} d  { fiches, marches, tentations, defis, cagnotte, reports, objectifEau, hiver }
 */
export function calculerMedailles(d) {
  const fiches = d.fiches;
  const quand = (test) => fiches.filter(test).map((f) => f.date);

  const medailles = [
    {
      id: 'cent_feux', nom: 'Cent feux', description: 'Allumer 100 feux de poêle (ceux d’avant l’app comptent).', icone: 'flamme', cible: 100, unite: 'feux',
      ...cumul([
        ...fiches.filter((f) => n(f.feux_poele) > 0).map((f) => ({ date: f.date, v: n(f.feux_poele) })),
        ...d.reports.filter((r) => r.type === 'hiver').map((r) => ({ date: r.premier || `${String(r.saison).slice(0, 4)}-${d.hiver.debut}`, v: n(r.nombre) })),
      ], 100),
    },
    {
      id: 'mille_km', nom: '1 000 km à pied', description: 'Marcher 1 000 km au total.', icone: 'botte', cible: 1000, unite: 'km',
      ...cumul(d.marches.map((m) => ({ date: m.date, v: n(m.km) })), 1000),
    },
    (() => {
      // Mister Me × 10 : dix tentations d'affilée gagnées par Mister Me (dans l'ordre où elles ont été notées).
      let courante = 0; let meilleure = 0; let date = null;
      for (const t of [...d.tentations].sort((a, b) => parDateCroissante(a, b) || String(a.id).localeCompare(String(b.id)))) {
        courante = t.gagnant === 'me' ? courante + 1 : 0;
        meilleure = Math.max(meilleure, courante);
        if (!date && courante >= 10) date = t.date;
      }
      return { id: 'mister_me_10', nom: 'Mister Me × 10', description: 'Dix tentations d’affilée gagnées par Mister Me.', icone: 'couronne', cible: 10, unite: 'd’affilée', valeur: meilleure, date };
    })(),
    {
      id: 'rossi_bise', nom: 'Rossi sous la bise', description: 'Prendre la moto un jour de bise.', icone: 'casque', cible: 1, unite: '',
      ...premiere(quand((f) => f.deplacement === 'moto' && biseDuJour(f))),
    },
    {
      id: 'guitar_hero', nom: 'Guitar hero', description: '100 sessions de guitare.', icone: 'mediator', cible: 100, unite: 'sessions',
      ...cumul(fiches.filter((f) => n(f.guitare) > 0).map((f) => ({ date: f.date, v: n(f.guitare) })), 100),
    },
    {
      id: 'leve_tot', nom: 'Lève-tôt', description: 'Couché avant 22 h sept soirs de suite.', icone: 'reveil', cible: 7, unite: 'soirs d’affilée',
      ...serie(quand((f) => { const m = minutesDe(f.sommeil_coucher); return m != null && m >= 12 * 60 && m < 22 * 60; }), 7),
    },
    {
      id: 'chef_maison', nom: 'Chef de la maison', description: '20 repas cuisinés par Nico.', icone: 'toque', cible: 20, unite: 'repas',
      ...cumul(fiches.filter((f) => String(f.cuisine || '').split(',').map((x) => x.trim()).includes('Nico')).map((f) => ({ date: f.date, v: 1 })), 20),
    },
    {
      id: 'abyssal', nom: 'Abyssal', description: 'Cinq nuits « Abyssale ».', icone: 'croissant', cible: 5, unite: 'nuits',
      ...cumul(fiches.filter((f) => n(f.sommeil_qualite) === 9).map((f) => ({ date: f.date, v: 1 })), 5),
    },
    {
      id: 'hydrate', nom: 'Hydraté', description: 'Objectif d’eau atteint 30 jours d’affilée.', icone: 'goutte', cible: 30, unite: 'jours d’affilée',
      ...serie(quand((f) => n(f.eau_ml) >= d.objectifEau), 30),
    },
    {
      id: 'journal_fidele', nom: 'Journal fidèle', description: '100 jours remplis (humeur du matin et du soir).', icone: 'livre', cible: 100, unite: 'jours',
      ...cumul(fiches.filter((f) => f.humeur_matin != null && f.humeur_soir != null).map((f) => ({ date: f.date, v: 1 })), 100),
    },
    {
      id: 'defis_3', nom: 'Défi tenu × 3', description: 'Réussir trois défis du mois.', icone: 'trophee', cible: 3, unite: 'défis',
      ...cumul(d.defis.filter((x) => x.resultat === 'reussi').map((x) => ({ date: bornesMois(x.mois).fin, v: 1 })), 3),
    },
    (() => {
      const c = d.cagnotte;
      const base = { id: 'cagnotte', nom: 'Cagnotte remplie', description: 'Atteindre l’objectif de la cagnotte.', icone: 'tirelire', unite: 'CHF' };
      if (!c) return { ...base, cible: 1, valeur: 0, date: null, unite: '', sansObjectif: true };
      return { ...base, cible: c.montant, ...cumul(d.tentations.filter((t) => t.gagnant === 'me' && t.date >= c.debut).map((t) => ({ date: t.date, v: n(t.montant_chf) })), c.montant) };
    })(),

    /* ---------- Médailles secrètes (affichées « ? Secrète » tant qu'elles ne sont pas obtenues) ---------- */
    {
      id: 'secrete_viking', secrete: true, nom: 'Le Viking', description: 'Un barbecue un jour de gel.', icone: 'gril', cible: 1, unite: '',
      ...premiere(quand((f) => n(f.barbecues) > 0 && ((f.meteo_tmin != null && n(f.meteo_tmin) < 0) || (f.meteo8_temp != null && n(f.meteo8_temp) < 0) || (f.nt8_temp_ext != null && n(f.nt8_temp_ext) < 0)))),
    },
    {
      id: 'secrete_zen', secrete: true, nom: 'Maître toltèque', description: 'Les quatre accords « Bon » sept jours de suite.', icone: 'feuille', cible: 7, unite: 'jours d’affilée',
      ...serie(quand((f) => ['accord_parole', 'accord_personnel', 'accord_supposition', 'accord_mieux'].every((c) => n(f[c]) === 3)), 7),
    },
    {
      id: 'secrete_loup', secrete: true, nom: 'Loup-garou', description: 'Couché après 1 h du matin une nuit de pleine lune.', icone: 'croissant', cible: 1, unite: '',
      ...premiere(quand((f) => {
        const m = minutesDe(f.sommeil_coucher);
        return m != null && m >= 60 && m < 6 * 60 && nomPhase(lune(decaler(f.date, -1)).phase) === 'Pleine lune';
      })),
    },
  ];
  return medailles.map((m) => ({ secrete: false, ...m, valeur: Math.round(m.valeur * 10) / 10 }));
}

const ent = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 1 });
const chf = new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 });

/** « 874 / 1 000 km », « 3 / 7 soirs d'affilée », « 120 / 1 200 CHF ». */
export function texteProgression(m) {
  if (m.sansObjectif) return 'Fixe d’abord une cagnotte';
  if (m.cible === 1) return 'Pas encore';
  if (m.unite === 'CHF') return `${chf.format(Math.min(m.valeur, m.cible))} / ${chf.format(m.cible)}`;
  return `${ent.format(Math.min(m.valeur, m.cible))} / ${ent.format(m.cible)}${m.unite ? ' ' + m.unite : ''}`;
}
