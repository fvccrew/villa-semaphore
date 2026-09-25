// Le contrat de location et les factures, fabriqués dans le navigateur à
// partir des données de la base (déjà filtrées par la RLS). pdf-lib et
// fontkit sont chargés à la première demande seulement : 1,3 Mo qu'aucun
// visiteur ne paie s'il ne télécharge rien. Polices du site, converties en
// TTF (Instrument Serif pour les titres, Inter pour le texte).
import { C, eur, jour, qte } from './commun.js';

const charges = {};
const script = (src) => (charges[src] ??= new Promise((ok, ko) => {
  const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s);
}));
const octets = (url) => fetch(url).then((r) => r.arrayBuffer());

// Les polices du site n'ont pas l'espace fine insécable ni la flèche
const net = (t) => String(t ?? '').replace(/ /g, ' ').replace(/→/g, 'au');

const A4 = [595.28, 841.89];
const MARGE = 56;
const ENCRE = [0.06, 0.06, 0.06], DOUX = [0.37, 0.37, 0.35], GRIS = [0.55, 0.55, 0.53], BASSIN = [0.18, 0.49, 0.52], FILET = [0.85, 0.84, 0.82];

async function document_(titre) {
  await script('vendor/pdf-lib.min.js');
  await script('vendor/fontkit.umd.min.js');
  const { PDFDocument, rgb, degrees } = window.PDFLib;
  const doc = await PDFDocument.create();
  doc.registerFontkit(window.fontkit);
  const [serif, texte, gras] = await Promise.all([
    octets('app/polices/instrument-serif.ttf'), octets('app/polices/inter.ttf'), octets('app/polices/inter-medium.ttf'),
  ]).then((f) => Promise.all(f.map((b) => doc.embedFont(b, { subset: true }))));
  doc.setTitle(titre); doc.setAuthor('Villa Sémaphore'); doc.setCreator('Villa Sémaphore, réalisé par Weboost Studio'); doc.setLanguage('fr-FR');
  const c = (v) => rgb(...v);

  // Un petit moteur de mise en page : y descend, une page s'ajoute au besoin
  const m = { doc, page: null, y: 0, pages: [] };
  m.nouvelle = () => {
    m.page = doc.addPage(A4); m.pages.push(m.page); m.y = A4[1] - MARGE;
    // l'en-tête : le pavillon S et le nom
    m.page.drawRectangle({ x: MARGE, y: m.y - 12, width: 12, height: 12, borderColor: c(ENCRE), borderWidth: 0.8 });
    m.page.drawRectangle({ x: MARGE + 3.6, y: m.y - 8.4, width: 4.8, height: 4.8, color: c(BASSIN) });
    m.page.drawText('Villa Sémaphore', { x: MARGE + 20, y: m.y - 11, size: 15, font: serif, color: c(ENCRE) });
    m.page.drawText(net(titre), { x: A4[0] - MARGE - texte.widthOfTextAtSize(net(titre), 8), y: m.y - 9, size: 8, font: texte, color: c(GRIS) });
    if (C.demo) {
      const d = 'Document de démonstration, sans valeur contractuelle';
      m.page.drawText(d, { x: MARGE, y: 28, size: 7.5, font: gras, color: c(BASSIN) });
      m.page.drawText('DÉMONSTRATION', { x: 150, y: 330, size: 64, font: gras, color: c(BASSIN), opacity: 0.06, rotate: degrees(35) });
    }
    m.y -= 44;
  };
  m.place = (h) => { if (m.y - h < MARGE + 20) m.nouvelle(); };
  // Texte qui passe à la ligne dans une largeur donnée
  m.lignes = (t, f, taille, largeur) => {
    const sortie = [];
    for (const para of net(t).split('\n')) {
      let l = '';
      for (const mot of para.split(' ')) {
        const essai = l ? l + ' ' + mot : mot;
        if (f.widthOfTextAtSize(essai, taille) > largeur && l) { sortie.push(l); l = mot; } else l = essai;
      }
      sortie.push(l);
    }
    return sortie;
  };
  m.texte = (t, { f = texte, taille = 9.5, couleur = ENCRE, x = MARGE, largeur = A4[0] - 2 * MARGE, inter = 1.45, apres = 4 } = {}) => {
    for (const l of m.lignes(t, f, taille, largeur)) {
      m.place(taille * inter);
      m.page.drawText(l, { x, y: m.y - taille, size: taille, font: f, color: c(couleur) });
      m.y -= taille * inter;
    }
    m.y -= apres;
  };
  m.titre = (t, taille = 30) => { m.place(taille + 10); m.page.drawText(net(t), { x: MARGE, y: m.y - taille * 0.8, size: taille, font: serif, color: c(ENCRE) }); m.y -= taille + 6; };
  m.rubrique = (t) => { m.y -= 8; m.place(30); m.page.drawText(net(t).toUpperCase(), { x: MARGE, y: m.y - 8, size: 7, font: gras, color: c(GRIS) }); m.y -= 16; };
  // Une ligne libellé ... montant, avec un filet dessous
  m.ligne = (g, d, { fort = false } = {}) => {
    const taille = fort ? 12 : 9.5, f = fort ? gras : texte;
    const dl = m.lignes(g, f, taille, A4[0] - 2 * MARGE - 140);
    m.place(dl.length * taille * 1.45 + 10);
    dl.forEach((l, i) => m.page.drawText(l, { x: MARGE, y: m.y - taille - i * taille * 1.45, size: taille, font: f, color: c(ENCRE) }));
    const ds = net(d);
    m.page.drawText(ds, { x: A4[0] - MARGE - f.widthOfTextAtSize(ds, taille), y: m.y - taille, size: taille, font: f, color: c(ENCRE) });
    m.y -= dl.length * taille * 1.45 + 5;
    m.page.drawLine({ start: { x: MARGE, y: m.y }, end: { x: A4[0] - MARGE, y: m.y }, thickness: 0.5, color: c(FILET) });
    m.y -= 6;
  };
  m.deux = (gauche, droite) => {
    // deux blocs côte à côte : [titre, lignes...]
    const l = (A4[0] - 2 * MARGE - 24) / 2;
    const y0 = m.y;
    let yMin = y0;
    [[gauche, MARGE], [droite, MARGE + l + 24]].forEach(([bloc, x]) => {
      m.y = y0;
      m.page.drawText(net(bloc[0]).toUpperCase(), { x, y: m.y - 8, size: 7, font: gras, color: c(GRIS) });
      m.y -= 18;
      bloc.slice(1).forEach((t, i) => m.texte(t, { x, largeur: l, f: i === 0 ? gras : texte, apres: 0 }));
      yMin = Math.min(yMin, m.y);
    });
    m.y = yMin - 10;
  };
  m.fin = async (nom) => {
    m.pages.forEach((p, i) => {
      const t = `${i + 1} / ${m.pages.length}`;
      p.drawText(t, { x: A4[0] - MARGE - texte.widthOfTextAtSize(t, 7.5), y: 28, size: 7.5, font: texte, color: c(GRIS) });
    });
    const b = await doc.save();
    const url = URL.createObjectURL(new Blob([b], { type: 'application/pdf' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nom });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  m.polices = { serif, texte, gras };
  return m;
}

const PROPRIETAIRE = ['Le propriétaire', 'Villa Sémaphore', 'Route de Gigaro', '83420 La Croix-Valmer', 'contact@villa-semaphore.fr · 04 94 00 00 00'];
const locataire = (cl) => ['Le locataire', cl?.nom || 'Client', cl?.email || '', cl?.telephone || ''].filter((x, i) => i < 2 || x);
const semaines = (r) => Math.round((new Date(r.depart) - new Date(r.arrivee)) / 604800000);
const paye = (r) => r.paiements.filter((p) => p.statut === 'paye').reduce((s, p) => s + p.montant, 0);

export async function contrat(r, cl) {
  const m = await document_(`Contrat ${r.reference}`);
  m.nouvelle();
  m.titre('Contrat de location saisonnière');
  m.texte(`Référence ${r.reference}, conclu en ligne le ${jour(r.cree_le.slice(0, 10))}.`, { couleur: DOUX, apres: 16 });
  m.deux(PROPRIETAIRE, locataire(cl));

  m.rubrique('Le séjour');
  m.ligne('Arrivée', `samedi ${jour(r.arrivee)}, à partir de 16 h`);
  m.ligne('Départ', `samedi ${jour(r.depart)}, avant 10 h`);
  m.ligne('Durée', `${semaines(r)} semaine${semaines(r) > 1 ? 's' : ''}`);
  m.ligne('Occupants', `${r.personnes} personne${r.personnes > 1 ? 's' : ''}, quatre au plus`);

  m.rubrique('Le prix');
  m.ligne('Location de la villa, services compris : conciergerie de 8 h à minuit, ménage quotidien, linge, petit-déjeuner livré', eur(r.montant_sejour));
  for (const s of r.reservation_services) m.ligne(`${s.nom}, ${qte(s.unite, s.quantite)}`, eur(s.montant));
  m.ligne('Total du séjour', eur(r.montant_total), { fort: true });
  if (r.solde_du_le) m.ligne(`Acompte versé à la réservation, puis solde de ${eur(r.montant_total - r.acompte)} dû le ${jour(r.solde_du_le)}`, eur(r.acompte));
  else m.ligne('Réglé en une fois à la réservation', eur(r.acompte));
  m.ligne('Déjà réglé à la date du document', eur(paye(r)));
  if (r.reservation_services.some((s) => s.montant == null)) m.texte('Les services sur devis sont chiffrés par la conciergerie et réglés à part.', { couleur: DOUX, taille: 8.5 });

  m.rubrique('Conditions');
  const conditions = [
    ['Caution', 'Un dépôt de garantie de 5 000 € est demandé à l’arrivée, par empreinte bancaire. Il est libéré dans les sept jours qui suivent le départ, déduction faite des éventuels dégâts constatés ensemble.'],
    ['Annulation', 'Annulée par le locataire plus de 60 jours avant l’arrivée, la réservation est remboursée, acompte compris. Entre 60 et 30 jours, l’acompte reste acquis. À moins de 30 jours, le séjour entier reste dû, sauf relocation des mêmes dates.'],
    ['Taxe de séjour', 'En sus du prix, selon le barème de la commune de La Croix-Valmer, réglée sur place.'],
    ['Usage', 'La villa est louée pour l’habitation des occupants déclarés. Ni fête ni événement, pas d’animaux, pas de tabac à l’intérieur. Le locataire justifie d’une assurance villégiature.'],
    ['Arrivée', 'L’adresse exacte et le code du portail sont communiqués la semaine de l’arrivée. Un état des lieux est fait à l’arrivée et au départ avec la conciergerie.'],
  ];
  for (const [t, d] of conditions) { m.texte(t, { f: m.polices.gras, apres: 0 }); m.texte(d, { couleur: DOUX, apres: 8 }); }
  m.y -= 6;
  m.texte(`Le locataire a accepté ces conditions en réservant en ligne. Les conditions générales complètes sont consultables sur la page Conditions de location du site.`, { taille: 8.5, couleur: GRIS });
  await m.fin(`contrat-${r.reference}.pdf`);
}

export async function facture(r, f, cl) {
  const p = r.paiements.find((x) => x.id === f.paiement_id);
  const m = await document_(`Facture ${f.numero}`);
  m.nouvelle();
  m.titre(`Facture ${f.numero}`);
  m.texte(`Émise le ${jour(f.emise_le.slice(0, 10))}, acquittée le ${jour((p?.paye_le || f.emise_le).slice(0, 10))}.`, { couleur: DOUX, apres: 16 });
  m.deux(['Émetteur', 'Villa Sémaphore', 'Route de Gigaro', '83420 La Croix-Valmer', C.demo ? 'SIRET : fictif, démonstration' : ''].filter(Boolean),
         ['Facturé à', cl?.nom || 'Client', cl?.email || ''].filter(Boolean));
  m.rubrique('Détail');
  const quoi = { acompte: 'Acompte', solde: 'Solde', total: 'Règlement' }[p?.type] || 'Règlement';
  m.ligne(`${quoi} du séjour ${r.reference} à la Villa Sémaphore, du ${jour(r.arrivee)} au ${jour(r.depart)}, ${r.personnes} personne${r.personnes > 1 ? 's' : ''}`, eur(f.montant));
  m.ligne('Total acquitté', eur(f.montant), { fort: true });
  m.y -= 6;
  m.texte(`Moyen de paiement : ${p?.stripe_session?.startsWith('virement') ? 'virement bancaire' : 'carte bancaire, par Stripe'}.`, { couleur: DOUX });
  m.texte(`Rappel du séjour : total ${eur(r.montant_total)}, réglé à ce jour ${eur(paye(r))}, reste ${eur(r.montant_total - paye(r))}.`, { couleur: DOUX });
  m.texte('Montants en euros, toutes taxes comprises. Taxe de séjour réglée sur place, non comprise.', { couleur: GRIS, taille: 8.5 });
  await m.fin(`facture-${f.numero}.pdf`);
}
