// Réserver : le calendrier des samedis, les services, le devis calculé par
// la base, la connexion sans quitter la page, puis le paiement Stripe.
import {
  sb, pret, C, eur, ajoute, aujourdhui, enDate, court, jour, plage, moisNom, esc, el, message,
  erreurDe, bandeauDemo, nonConfigure, session, profil, lienCompte, panneauConnexion, UNITE, qte, PHOTO,
} from './commun.js';

const $ = (s) => document.querySelector(s);
const ETAT = { choix: null, personnes: 2, quantites: new Map(), vue: 0, devis: null, note: '', conditions: false };
let bien, saisons, services, samedis, moisListe, minuteurDevis, numeroDevis = 0;

bandeauDemo($('.bandeau-photo'));
if (!pret) nonConfigure($('.reserver')); else demarrer();

async function demarrer() {
  const auj = aujourdhui();
  const [b, s, sv, occ] = await Promise.all([
    sb.from('biens').select('*').eq('id', 1).single(),
    sb.from('saisons').select('nom, debut, fin, prix_semaine').eq('bien_id', 1).order('debut'),
    sb.from('services').select('*').eq('bien_id', 1).eq('actif', true).order('ordre'),
    sb.rpc('semaines_occupees', { p_de: auj, p_a: ajoute(auj, 800) }),
  ]);
  if (b.error || s.error || sv.error || occ.error) {
    $('#mois').innerHTML = '<p class="chargement">Le calendrier ne répond pas. Rechargez la page dans un instant.</p>';
    return;
  }
  bien = b.data; saisons = s.data; services = sv.data;
  $('#capacite').textContent = bien.capacite;
  $('#pct').textContent = bien.acompte_pct + ' %';
  ETAT.personnes = Math.min(2, bien.capacite);

  // Tous les samedis réservables, du délai minimal à l'horizon
  let d = ajoute(auj, bien.delai_jours);
  while (enDate(d).getUTCDay() !== 6) d = ajoute(d, 1);
  const fin = enDate(auj); fin.setUTCMonth(fin.getUTCMonth() + bien.horizon_mois);
  samedis = [];
  for (; enDate(d) <= fin; d = ajoute(d, 7)) {
    const sa = saisons.find((x) => x.debut <= d && d < x.fin);
    const prise = occ.data.some((o) => o.arrivee < ajoute(d, 7) && d < o.depart);
    samedis.push({ iso: d, saison: sa?.nom, prix: sa?.prix_semaine, etat: prise ? 'prise' : sa ? 'libre' : 'ferme' });
  }
  moisListe = [...new Set(samedis.map((x) => x.iso.slice(0, 7)))];

  // Arrivée depuis une carte de saison de l'accueil : ?saison=ete
  const voulu = { ete: 'Été', printemps: 'Printemps', automne: 'Automne', hors: 'Hors saison' }[new URLSearchParams(location.search).get('saison')];
  if (voulu) {
    const premier = samedis.find((x) => x.saison === voulu && x.etat === 'libre') || samedis.find((x) => x.saison === voulu);
    if (premier) ETAT.vue = Math.max(0, Math.min(moisListe.indexOf(premier.iso.slice(0, 7)), moisListe.length - 3));
  }
  $('#avant').addEventListener('click', () => { ETAT.vue = Math.max(0, ETAT.vue - pas()); calendrier(); });
  $('#apres').addEventListener('click', () => { ETAT.vue = Math.min(moisListe.length - 1, ETAT.vue + pas()); calendrier(); });
  addEventListener('resize', () => calendrier());
  calendrier();
  resume();
  lienCompte();
}

// Trois mois au bureau, deux sur tablette, un sur téléphone
const pas = () => (innerWidth <= 640 ? 1 : innerWidth <= 1100 ? 2 : 3);

function semainesChoisies() {
  if (!ETAT.choix) return [];
  const i = samedis.findIndex((x) => x.iso === ETAT.choix.debut);
  return samedis.slice(i, i + ETAT.choix.n);
}

function calendrier() {
  const vus = moisListe.slice(ETAT.vue, ETAT.vue + 3);
  const choisies = new Set(semainesChoisies().map((x) => x.iso));
  const suivante = ETAT.choix && ETAT.choix.n < 4 ? ajoute(ETAT.choix.debut, 7 * ETAT.choix.n) : null;
  const an = (m) => m.slice(0, 4);
  const dernier = vus[Math.min(pas(), vus.length) - 1];
  $('#titre-mois').textContent = !vus.length ? 'Les semaines'
    : dernier === vus[0] ? `${moisNom(vus[0] + '-01')} ${an(vus[0])}`
    : `${moisNom(vus[0] + '-01')} à ${moisNom(dernier + '-01')} ${an(dernier)}`;
  $('#avant').disabled = ETAT.vue === 0;
  $('#apres').disabled = ETAT.vue + pas() >= moisListe.length;
  const zone = $('#mois');
  zone.innerHTML = '';
  for (const m of vus) {
    const sem = samedis.filter((x) => x.iso.slice(0, 7) === m);
    const noms = [...new Set(sem.map((x) => x.saison).filter(Boolean))].join(', ').toLowerCase();
    const carte = el(`<div class="carte-mois"><h3>${moisNom(m + '-01')} <small>${esc(noms || 'pas encore ouvert')}</small></h3></div>`);
    for (const x of sem) {
      const cls = choisies.has(x.iso) ? 'choisie' : x.etat !== 'libre' ? x.etat : x.iso === suivante ? 'voisine' : '';
      const libelle = `${court(x.iso)} → ${court(ajoute(x.iso, 7))}`;
      const b = el(`<button type="button" class="semaine ${cls}" ${x.etat !== 'libre' ? 'disabled' : ''}
        aria-pressed="${choisies.has(x.iso)}" aria-label="Semaine du ${jour(x.iso)}, ${x.etat === 'prise' ? 'prise' : x.etat === 'ferme' ? 'pas encore ouverte' : eur(x.prix)}">
        <span>${libelle}${x.etat === 'prise' ? ' · prise' : ''}</span><span class="px">${x.prix ? eur(x.prix) : '—'}</span></button>`);
      b.addEventListener('click', () => choisir(x.iso));
      carte.appendChild(b);
    }
    zone.appendChild(carte);
  }
}

function choisir(iso) {
  const c = ETAT.choix;
  const suivante = c ? ajoute(c.debut, 7 * c.n) : null;
  if (c && iso === suivante && c.n < 4) c.n++;
  else if (c && iso >= c.debut && iso < suivante) {
    const k = Math.round((enDate(iso) - enDate(c.debut)) / (7 * 86400000)) + 1;
    if (k === c.n && k === 1) ETAT.choix = null; else c.n = k;
  } else ETAT.choix = { debut: iso, n: 1 };
  calendrier();
  devis();
}

// Le devis vient de la base : le navigateur n'additionne rien
function devis() {
  clearTimeout(minuteurDevis);
  if (!ETAT.choix) { ETAT.devis = null; resume(); return; }
  resume(true);
  minuteurDevis = setTimeout(async () => {
    const n = ++numeroDevis;
    const { data, error } = await sb.rpc('devis', {
      p_arrivee: ETAT.choix.debut, p_depart: ajoute(ETAT.choix.debut, 7 * ETAT.choix.n),
      p_personnes: ETAT.personnes, p_services: listeServices(),
    });
    if (n !== numeroDevis) return;           // une réponse plus récente arrive
    ETAT.devis = error ? { erreur: error.message } : data;
    resume();
  }, 180);
}

const listeServices = () => [...ETAT.quantites].filter(([, q]) => q > 0).map(([id, quantite]) => ({ id, quantite }));

function resume(calcul = false) {
  const z = $('#resume');
  const sem = semainesChoisies();
  const d = ETAT.devis;
  const premiere = sem[0];
  const photo = PHOTO[premiere?.saison] || 'planches/f0204.webp';
  const titre = premiere ? plage(premiere.iso, ajoute(premiere.iso, 7 * sem.length)) : 'Votre séjour';
  const lignesServices = services.map((s) => {
    const q = ETAT.quantites.get(s.id) || 0;
    const ligne = d?.services?.find((l) => l.id === s.id);
    const max = s.unite === 'forfait' ? 1 : s.unite === 'heure' ? 40 : 14;
    return `<div class="option"><span>${esc(s.nom)}<small>${s.prix == null ? 'sur devis, confirmé par la conciergerie' : `${eur(s.prix)} ${UNITE[s.unite]}`}</small></span>
      <span class="pas" data-service="${s.id}"><button type="button" data-d="-1" aria-label="Moins" ${q === 0 ? 'disabled' : ''}>−</button><output>${q ? qte(s.unite, q) : '0'}</output><button type="button" data-d="1" aria-label="Plus" ${q >= max ? 'disabled' : ''}>+</button></span>
      ${q ? `<span class="montant">${ligne ? eur(ligne.montant) : '…'}</span>` : ''}</div>`;
  }).join('');

  z.innerHTML = `
    <div class="img"><img src="${photo}" alt=""><span class="pastille sur-photo">${premiere ? esc(premiere.saison) + ' ' + premiere.iso.slice(0, 4) : 'Du samedi au samedi'}</span></div>
    <div class="dedans">
      <h2>${titre}</h2>
      ${!premiere ? `<p class="vide">Choisissez un samedi d'arrivée dans le calendrier. Le prix se calcule à mesure, services compris.</p>` : ''}
      ${sem.map((x) => `<div class="ligne"><span>Semaine du ${court(x.iso)} · ${esc(x.saison.toLowerCase())}</span><span>${eur(x.prix)}</span></div>`).join('')}
      <div class="ligne"><span>Personnes</span><span class="pas" id="personnes"><button type="button" data-d="-1" aria-label="Une personne de moins" ${ETAT.personnes <= 1 ? 'disabled' : ''}>−</button><output>${ETAT.personnes}</output><button type="button" data-d="1" aria-label="Une personne de plus" ${ETAT.personnes >= bien.capacite ? 'disabled' : ''}>+</button></span></div>
      <p class="titre-carte" style="margin-top:18px">Services de la conciergerie</p>
      ${lignesServices}
      ${premiere ? `
        <div class="total"><span>Total</span><b>${calcul || !d || d.erreur ? '…' : eur(d.total)}</b></div>
        ${d && !d.erreur && !calcul ? `<p class="petit doux">${d.solde_du_le
          ? `Acompte aujourd'hui ${eur(d.acompte)}, solde de ${eur(d.solde)} avant le ${jour(d.solde_du_le)}.`
          : `Réglé en une fois : l'arrivée est dans moins de ${bien.solde_jours} jours.`}${d.sur_devis ? ' Les services sur devis sont confirmés et réglés à part.' : ''}</p>` : ''}
        <p class="erreur">${d?.erreur ? esc(d.erreur) : ''}</p>
        <div class="actions-resume">
          <div class="champ-app"><label for="note">Un mot pour la conciergerie (facultatif${C.demo ? ", rien de personnel : c'est une démonstration" : ''})</label><textarea id="note" maxlength="2000" rows="2">${esc(ETAT.note)}</textarea></div>
          <label class="case"><input type="checkbox" id="conditions" ${ETAT.conditions ? 'checked' : ''}><span>J'ai lu les <a href="conditions.html" target="_blank" rel="noopener">conditions de location</a> : acompte, annulation, caution de 5 000 € à l'arrivée.</span></label>
          <button class="bouton plein large" type="button" id="reserver" ${calcul || !d || d.erreur ? 'disabled' : ''}>
            <span>${d && !d.erreur && !calcul ? (d.solde_du_le ? `Réserver et payer l'acompte · ${eur(d.acompte)}` : `Réserver et payer · ${eur(d.acompte)}`) : 'Calcul du prix…'}</span>
            <span class="fleche"><svg viewBox="0 0 12 12"><path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5"/></svg></span></button>
          <p class="petit gris">Paiement par carte sur la page sécurisée de Stripe. Vos dates sont gardées ${bien.attente_minutes} minutes le temps de payer.</p>
        </div>` : ''}
    </div>`;

  z.querySelectorAll('.pas[data-service] button').forEach((b) => b.addEventListener('click', () => {
    const id = Number(b.closest('.pas').dataset.service);
    const s = services.find((x) => x.id === id);
    const max = s.unite === 'forfait' ? 1 : s.unite === 'heure' ? 40 : 14;
    ETAT.quantites.set(id, Math.max(0, Math.min(max, (ETAT.quantites.get(id) || 0) + Number(b.dataset.d))));
    ETAT.choix ? devis() : resume();
  }));
  z.querySelectorAll('#personnes button').forEach((b) => b.addEventListener('click', () => {
    ETAT.personnes = Math.max(1, Math.min(bien.capacite, ETAT.personnes + Number(b.dataset.d)));
    ETAT.choix ? devis() : resume();
  }));
  z.querySelector('#note')?.addEventListener('input', (e) => { ETAT.note = e.target.value; });
  z.querySelector('#conditions')?.addEventListener('change', (e) => { ETAT.conditions = e.target.checked; });
  z.querySelector('#reserver')?.addEventListener('click', reserver);
}

async function reserver() {
  const erreur = $('#resume .erreur');
  if (!ETAT.conditions) { erreur.textContent = 'Cochez la case des conditions de location pour continuer.'; return; }
  if (!(await session())) { connexion(); return; }
  const p = await profil();
  if (p?.role === 'admin') { erreur.textContent = 'Vous êtes connecté en propriétaire : réservez avec un compte client.'; return; }

  const bouton = $('#reserver');
  bouton.classList.add('occupe');
  bouton.querySelector('span').textContent = 'Réservation des dates…';
  const { data: r, error } = await sb.rpc('creer_reservation', {
    p_arrivee: ETAT.choix.debut, p_depart: ajoute(ETAT.choix.debut, 7 * ETAT.choix.n),
    p_personnes: ETAT.personnes, p_services: listeServices(), p_note: ETAT.note.trim() || null,
  });
  if (error) {
    bouton.classList.remove('occupe');
    erreur.textContent = error.message;
    if (/prises/.test(error.message)) { message(error.message, true); setTimeout(() => location.reload(), 2500); }
    else resume();
    return;
  }
  bouton.querySelector('span').textContent = 'Ouverture du paiement…';
  const { data, error: e2 } = await sb.functions.invoke('paiement', { body: { reservation: r.id, retour: location.href } });
  if (e2 || !data?.url) {
    bouton.classList.remove('occupe');
    erreur.innerHTML = `${esc(e2 ? await erreurDe(e2) : 'Le paiement ne répond pas.')} Vos dates sont gardées ${bien.attente_minutes} minutes : réglez depuis <a href="compte.html">votre espace</a>.`;
    return;
  }
  location.href = data.url;
}

function connexion() {
  const d = $('#fenetre-connexion');
  panneauConnexion($('#corps-connexion'), {
    titre: 'Connectez-vous pour réserver', role: 'client',
    apres: async () => { d.close(); await lienCompte(); message('Vous êtes connecté.'); reserver(); },
  });
  d.querySelector('.fermer').onclick = () => d.close();
  d.showModal();
}
