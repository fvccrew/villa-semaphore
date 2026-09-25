// L'administration : vue d'ensemble, planning, réservations, clients,
// tarifs et services. Tout passe par la RLS : un compte qui n'est pas
// admin ne lit que ses propres données, cet écran ne lui montre rien.
import {
  sb, pret, eur, ajoute, aujourdhui, enDate, court, jour, plage, moisNom, esc, el, message, initiales,
  bandeauDemo, nonConfigure, session, profil, lienCompte, deconnexion, panneauConnexion, STATUT, UNITE, qte,
} from './commun.js';

const zone = document.getElementById('zone');
const fiche = document.getElementById('fiche');
fiche.querySelector('.fermer').addEventListener('click', () => fiche.close());
let moi, resas = [], clients = [], saisons = [], services = [], onglet = location.hash.slice(1) || 'ensemble';
let filtre = { statut: 'avenir', texte: '', client: null };

const ONGLETS = { ensemble: "Vue d'ensemble", planning: 'Planning', reservations: 'Réservations', clients: 'Clients', tarifs: 'Tarifs et saisons', services: 'Services' };
const COULEURS = ['#4d5860', '#8a6a4d', '#2e7d84', '#6b5b73', '#7a6a3a', '#3e6b52'];
const couleur = (id) => COULEURS[[...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) % COULEURS.length];

bandeauDemo(zone);
if (!pret) nonConfigure(zone); else demarrer();

async function demarrer() {
  if (!(await session())) return accueil();
  moi = await profil();
  if (moi?.role !== 'admin') {
    zone.innerHTML = `<div class="carte-app" style="max-width:560px;margin:40px auto"><p class="titre-carte">Accès réservé</p>
      <h2>Cet espace est celui du propriétaire.</h2><p class="doux" style="margin:12px 0 18px">Vous êtes connecté avec un compte client.</p>
      <a class="bouton plein" href="compte.html">Mon compte</a> <button class="bouton contour" id="sortir">Se déconnecter</button></div>`;
    zone.querySelector('#sortir').addEventListener('click', () => deconnexion('admin.html'));
    return;
  }
  await charger();
  afficher();
  lienCompte();
  addEventListener('hashchange', () => { onglet = location.hash.slice(1) || 'ensemble'; afficher(); });
}

function accueil() {
  zone.innerHTML = `<section class="connexion">
    <div class="photo-connexion"><img src="planches/f0001.webp" alt=""><p>Le planning, les réservations, les tarifs de la villa.</p></div>
    <div class="carte-app" id="panneau"></div></section>`;
  panneauConnexion(zone.querySelector('#panneau'), { titre: 'Administration', role: 'admin', apres: () => location.reload() });
}

async function charger() {
  const [r, c, s, v] = await Promise.all([
    sb.from('reservations').select('*, client:profils(id, nom, email, telephone), reservation_services(*), paiements(*), factures(*)').order('arrivee'),
    sb.from('profils').select('*').eq('role', 'client').order('nom'),
    sb.from('saisons').select('*').eq('bien_id', 1).order('debut'),
    sb.from('services').select('*').eq('bien_id', 1).order('ordre'),
  ]);
  for (const x of [r, c, s, v]) if (x.error) { message('Chargement impossible : ' + x.error.message, true); return; }
  resas = r.data; clients = c.data; saisons = s.data; services = v.data;
  // En démo, la base ne rend pas le profil d'un visiteur inscrit : son
  // séjour tient le planning sous un nom générique, sans coordonnées
  for (const x of resas) if (x.client_id && !x.client) x.client = { id: x.client_id, nom: 'Visiteur de la démo', masque: true };
}

// ------------------------------------------------------------ calculs
const paye = (r) => r.paiements.filter((p) => p.statut === 'paye').reduce((s, p) => s + p.montant, 0);
const vivante = (r) => r.statut === 'confirmee' || r.statut === 'bloquee' || (r.statut === 'attente_paiement' && new Date(r.expire_le) > new Date());
const surSemaine = (iso) => resas.find((r) => vivante(r) && r.arrivee <= iso && iso < r.depart);
const enRetard = (r) => r.statut === 'confirmee' && r.solde_du_le && r.solde_du_le < aujourdhui() && paye(r) < r.montant_total;
const nomClient = (r) => r.statut === 'bloquee' ? 'Fermée' : esc(r.client?.nom || 'Client supprimé');
const samedisDepuis = (iso, n) => {
  let d = iso; while (enDate(d).getUTCDay() !== 6) d = ajoute(d, 1);
  return Array.from({ length: n }, (_, i) => ajoute(d, 7 * i));
};
function etatPaiement(r) {
  if (r.statut === 'bloquee') return `<span class="pastille bloquee">Fermée</span>`;
  if (r.statut !== 'confirmee') return `<span class="pastille ${r.statut}">${STATUT[r.statut]}</span>`;
  if (enRetard(r)) return `<span class="pastille retard">Solde en retard · ${eur(r.montant_total - paye(r))}</span>`;
  return paye(r) >= r.montant_total ? `<span class="pastille solde">Soldé</span>` : `<span class="pastille">Acompte payé</span>`;
}

// ------------------------------------------------------------ l'écran
function afficher() {
  zone.innerHTML = `
    <div class="admin-tete"><h1>${esc(ONGLETS[onglet] || '')}</h1>
      <div class="onglets" role="tablist">${Object.entries(ONGLETS).map(([k, v]) =>
        `<button role="tab" aria-selected="${k === onglet}" data-o="${k}">${v}</button>`).join('')}
        <button class="bouton contour petit" id="sortir" type="button">Se déconnecter</button></div></div>
    <div id="contenu"></div>`;
  zone.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.o; }));
  zone.querySelector('#sortir').addEventListener('click', () => deconnexion('admin.html'));
  const c = zone.querySelector('#contenu');
  const ecran = { ensemble, planning, reservations, clients: ecranClients, tarifs, services: ecranServices }[onglet] || ensemble;
  ecran(c);
}

function ensemble(c) {
  const auj = aujourdhui();
  const an = samedisDepuis(auj, 52);
  const pris = an.filter((s) => { const r = surSemaine(s); return r && r.statut !== 'bloquee'; }).length;
  const ete = an.filter((s) => { const m = s.slice(5, 7); return m === '07' || m === '08'; });
  const etePris = ete.filter((s) => { const r = surSemaine(s); return r && r.statut !== 'bloquee'; }).length;
  const annee = auj.slice(0, 4);
  const encaisse = resas.flatMap((r) => r.paiements).filter((p) => p.statut === 'paye' && p.paye_le.slice(0, 4) === annee).reduce((s, p) => s + p.montant, 0);
  const aVenir = resas.filter((r) => r.statut === 'confirmee' && r.depart >= auj);
  const reste = aVenir.reduce((s, r) => s + r.montant_total - paye(r), 0);
  const retards = aVenir.filter(enRetard);
  const sousDevis = resas.filter((r) => r.statut === 'confirmee' && r.depart >= auj && r.reservation_services.some((s) => s.montant == null));
  const prochaines = aVenir.slice(0, 5);
  const abrege = (s) => { const t = enDate(s).toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }); return t[0].toUpperCase() + t.slice(1); };
  const moisEtiquettes = (liste) => liste.filter((s, i) => i === 0 || s.slice(5, 7) !== liste[i - 1].slice(5, 7)).slice(0, 6).map((s) => `<span>${abrege(s)}</span>`).join('');

  c.innerHTML = `
    <section class="bandeau-photo" style="min-height:230px"><img src="planches/f0001.webp" alt="">
      <div class="dessus"><div class="verres quatre">
        <div class="verre"><b>${Math.round(pris / 52 * 100)} %</b><small>d'occupation sur un an, ${pris} semaines sur 52</small></div>
        <div class="verre"><b>${etePris} / ${ete.length}</b><small>semaines d'été vendues</small></div>
        <div class="verre"><b>${eur(encaisse)}</b><small>encaissés en ${annee}</small></div>
        <div class="verre"><b>${eur(reste)}</b><small>à encaisser${retards.length ? `, dont ${retards.length} solde${retards.length > 1 ? 's' : ''} en retard` : ''}</small></div>
      </div></div></section>
    <div class="grille-app deux">
      <div class="pile"><div class="carte-app"><p class="titre-carte">Les 52 prochaines semaines</p>
        <div class="semaines-an">${an.slice(0, 26).map(pilule).join('')}</div><div class="mois-an">${moisEtiquettes(an.slice(0, 26))}</div>
        <div class="semaines-an">${an.slice(26).map(pilule).join('')}</div><div class="mois-an">${moisEtiquettes(an.slice(26))}</div>
        <div class="legende"><span>■ Confirmée</span><span style="color:var(--bassin)">▨ En attente de paiement</span><span style="color:#a9a6a0">■ Fermée</span><span>Cliquez une semaine pour l'ouvrir</span></div></div>
        ÀFAIRE</div>
      <div class="pile">
        <div class="carte-app"><p class="titre-carte">Prochaines arrivées</p>
          ${prochaines.length ? prochaines.map((r) => `<div class="personne cliquable" data-r="${r.id}" style="cursor:pointer">
            <span class="av" style="background:${couleur(r.client_id)}">${esc(initiales(r.client?.nom))}</span>
            <span>${nomClient(r)}<br><small class="gris">${court(r.arrivee)} · ${(r.depart > r.arrivee) ? Math.round((enDate(r.depart) - enDate(r.arrivee)) / 604800000) : 1} sem. · ${r.personnes} pers.</small></span>${etatPaiement(r)}</div>`).join('')
          : '<p class="petit doux">Aucune arrivée prévue.</p>'}</div>
      </div>
    </div>`.replace('ÀFAIRE', `<div class="carte-app"><p class="titre-carte">À faire</p>
          ${retards.map((r) => `<div class="ligne cliquable" data-r="${r.id}" style="cursor:pointer"><span>Relancer ${nomClient(r)} pour le solde</span><span>${eur(r.montant_total - paye(r))}</span></div>`).join('')}
          ${sousDevis.map((r) => `<div class="ligne cliquable" data-r="${r.id}" style="cursor:pointer"><span>Chiffrer ${r.reservation_services.filter((s) => s.montant == null).map((s) => esc(s.nom.toLowerCase())).join(', ')} pour ${nomClient(r)}</span><span>${court(r.arrivee)}</span></div>`).join('')}
          ${!retards.length && !sousDevis.length ? '<p class="petit doux">Rien en retard. Tout est en ordre.</p>' : ''}</div>`);
  c.querySelectorAll('[data-r]').forEach((x) => x.addEventListener('click', () => ouvrirResa(Number(x.dataset.r))));
  c.querySelectorAll('.semaines-an i').forEach((x) => x.addEventListener('click', () => ouvrirSemaine(x.dataset.s)));
}

function pilule(iso) {
  const r = surSemaine(iso);
  return `<i class="${r ? r.statut : ''}${iso <= aujourdhui() && aujourdhui() < ajoute(iso, 7) ? ' aujourdhui' : ''}" data-s="${iso}" title="Semaine du ${jour(iso)}${r ? ' · ' + (r.statut === 'bloquee' ? 'fermée' : esc(r.client?.nom)) : ' · libre'}" style="cursor:pointer"></i>`;
}

function planning(c) {
  const semaines = samedisDepuis(ajoute(aujourdhui(), -14), 80);
  let html = '<div class="planning">', mois = '';
  for (const s of semaines) {
    if (s.slice(0, 7) !== mois) { mois = s.slice(0, 7); html += `<p class="mois-titre">${moisNom(s)} ${s.slice(0, 4)}</p>`; }
    const r = surSemaine(s);
    const sa = saisons.find((x) => x.debut <= s && s < x.fin);
    html += `<button class="case-semaine ${r ? r.statut : ''}" data-s="${s}">
      <b>${court(s)} → ${court(ajoute(s, 7))}</b>
      <span>${r ? (r.statut === 'bloquee' ? esc(r.note_admin || 'Fermée') : nomClient(r)) : sa ? `Libre · ${eur(sa.prix_semaine)}` : 'Pas de tarif'}</span></button>`;
  }
  c.innerHTML = html + '</div>';
  c.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => ouvrirSemaine(b.dataset.s)));
}

function reservations(c) {
  const auj = aujourdhui();
  const liste = resas.filter((r) => r.statut !== 'bloquee').filter((r) => {
    if (filtre.client && r.client_id !== filtre.client) return false;
    if (filtre.statut === 'avenir' && !(r.depart >= auj && r.statut !== 'annulee')) return false;
    if (filtre.statut === 'passees' && !(r.depart < auj && r.statut === 'confirmee')) return false;
    if (['confirmee', 'attente_paiement', 'annulee'].includes(filtre.statut) && r.statut !== filtre.statut) return false;
    const t = filtre.texte.toLowerCase();
    return !t || (r.reference + ' ' + (r.client?.nom || '') + ' ' + (r.client?.email || '')).toLowerCase().includes(t);
  });
  const nomFiltreClient = filtre.client ? clients.find((x) => x.id === filtre.client)?.nom : null;
  c.innerHTML = `<div class="carte-app">
    <div class="filtres">${Object.entries({ avenir: 'À venir', confirmee: 'Confirmées', attente_paiement: 'En attente', passees: 'Passées', annulee: 'Annulées', toutes: 'Toutes' })
      .map(([k, v]) => `<button class="bouton petit ${filtre.statut === k ? '' : 'contour'}" data-f="${k}">${v}</button>`).join('')}
      <input type="search" placeholder="Nom, e-mail ou référence" value="${esc(filtre.texte)}" aria-label="Rechercher">
      ${nomFiltreClient ? `<button class="bouton petit contour" id="sans-client">${esc(nomFiltreClient)} ×</button>` : ''}</div>
    <div class="defile"><table class="tableau"><thead><tr><th>Référence</th><th>Client</th><th>Séjour</th><th>Pers.</th><th class="num">Total</th><th class="num">Payé</th><th>État</th></tr></thead>
    <tbody>${liste.map((r) => `<tr class="cliquable" data-r="${r.id}"><td>${esc(r.reference)}</td><td>${nomClient(r)}</td><td>${plage(r.arrivee, r.depart)}</td>
      <td>${r.personnes}</td><td class="num">${eur(r.montant_total)}</td><td class="num">${eur(paye(r))}</td><td>${etatPaiement(r)}</td></tr>`).join('')
      || '<tr><td colspan="7" class="doux">Aucune réservation dans ce filtre.</td></tr>'}</tbody></table></div></div>`;
  c.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filtre.statut = b.dataset.f; reservations(c); }));
  const champ = c.querySelector('input[type=search]');
  champ.addEventListener('input', () => { filtre.texte = champ.value; const pos = champ.selectionStart; reservations(c); const n = c.querySelector('input[type=search]'); n.focus(); n.setSelectionRange(pos, pos); });
  c.querySelector('#sans-client')?.addEventListener('click', () => { filtre.client = null; reservations(c); });
  c.querySelectorAll('[data-r]').forEach((x) => x.addEventListener('click', () => ouvrirResa(Number(x.dataset.r))));
}

function ecranClients(c) {
  c.innerHTML = `<div class="carte-app"><div class="defile"><table class="tableau"><thead><tr><th>Client</th><th>E-mail</th><th>Téléphone</th><th class="num">Séjours</th><th class="num">Payé</th><th>Client depuis</th></tr></thead><tbody>
    ${clients.map((p) => {
      const siens = resas.filter((r) => r.client_id === p.id && r.statut === 'confirmee');
      return `<tr class="cliquable" data-c="${p.id}"><td><span style="display:inline-flex;gap:10px;align-items:center"><span class="av" style="background:${couleur(p.id)}">${esc(initiales(p.nom))}</span>${esc(p.nom || '—')}</span></td>
        <td>${p.email ? `<a href="mailto:${esc(p.email)}" onclick="event.stopPropagation()">${esc(p.email)}</a>` : '—'}</td><td>${esc(p.telephone || '—')}</td>
        <td class="num">${siens.length}</td><td class="num">${eur(siens.reduce((s, r) => s + paye(r), 0))}</td><td>${jour(p.cree_le.slice(0, 10))}</td></tr>`;
    }).join('') || '<tr><td colspan="6" class="doux">Aucun client.</td></tr>'}</tbody></table></div></div>`;
  c.querySelectorAll('[data-c]').forEach((x) => x.addEventListener('click', () => { filtre = { statut: 'toutes', texte: '', client: x.dataset.c }; location.hash = 'reservations'; }));
}

// ------------------------------------------------------------ tarifs et services
function tarifs(c) {
  const auj = aujourdhui();
  c.innerHTML = `<div class="carte-app"><p class="petit doux" style="margin-bottom:12px">Une saison couvre les samedis d'arrivée compris entre son début et sa fin (exclue). Deux saisons ne se chevauchent pas. Le nouveau prix vaut pour les prochaines réservations, jamais pour celles déjà faites.</p>
    <div class="defile"><table class="tableau"><thead><tr><th>Saison</th><th>Du</th><th>Au (exclu)</th><th class="num">Prix de la semaine</th><th></th></tr></thead><tbody>
    ${saisons.filter((s) => s.fin > auj).map((s) => `<tr data-id="${s.id}"><td><input name="nom" value="${esc(s.nom)}"></td><td><input name="debut" type="date" value="${s.debut}"></td>
      <td><input name="fin" type="date" value="${s.fin}"></td><td><input name="prix" type="number" min="1" step="100" value="${s.prix_semaine / 100}" style="text-align:right"></td>
      <td style="white-space:nowrap"><button class="bouton petit" data-a="garder">Enregistrer</button> <button class="bouton petit danger" data-a="suppr">Supprimer</button></td></tr>`).join('')}
    <tr data-id=""><td><input name="nom" placeholder="Nouvelle saison"></td><td><input name="debut" type="date"></td><td><input name="fin" type="date"></td>
      <td><input name="prix" type="number" min="1" step="100" placeholder="€" style="text-align:right"></td><td><button class="bouton petit" data-a="garder">Ajouter</button></td></tr>
    </tbody></table></div></div>`;
  c.querySelectorAll('tr[data-id]').forEach((tr) => {
    tr.querySelector('[data-a=garder]').addEventListener('click', async () => {
      const v = (n) => tr.querySelector(`[name=${n}]`).value;
      const ligne = { bien_id: 1, nom: v('nom').trim(), debut: v('debut'), fin: v('fin'), prix_semaine: Math.round(Number(v('prix')) * 100) };
      if (!ligne.nom || !ligne.debut || !ligne.fin || !(ligne.prix_semaine > 0)) { message('Remplissez le nom, les deux dates et le prix.', true); return; }
      const { error } = tr.dataset.id ? await sb.from('saisons').update(ligne).eq('id', tr.dataset.id) : await sb.from('saisons').insert(ligne);
      if (error) { message(/exclu|conflict|overlap/i.test(error.message) ? 'Cette saison chevauche une autre.' : error.message, true); return; }
      message('Saison enregistrée.'); await charger(); tarifs(c);
    });
    tr.querySelector('[data-a=suppr]')?.addEventListener('click', async () => {
      if (!confirm('Supprimer cette saison ? Ses semaines ne seront plus réservables.')) return;
      const { error } = await sb.from('saisons').delete().eq('id', tr.dataset.id);
      if (error) { message(error.message, true); return; }
      message('Saison supprimée.'); await charger(); tarifs(c);
    });
  });
}

function ecranServices(c) {
  const unites = Object.keys(UNITE).map((u) => [u, { forfait: 'forfait', jour: 'par jour', heure: "à l'heure", seance: 'par séance', repas: 'par personne et par dîner' }[u]]);
  const choix = (val) => unites.map(([u, l]) => `<option value="${u}" ${u === val ? 'selected' : ''}>${l}</option>`).join('');
  c.innerHTML = `<div class="carte-app"><p class="petit doux" style="margin-bottom:12px">Laissez le prix vide pour un service sur devis : le client le demande, la conciergerie le chiffre ensuite. Un service désactivé disparaît de la réservation sans toucher aux séjours déjà réservés.</p>
    <div class="defile"><table class="tableau"><thead><tr><th>Service</th><th>Description</th><th class="num">Prix</th><th>Unité</th><th>Actif</th><th></th></tr></thead><tbody>
    ${[...services, { id: '', nom: '', description: '', prix: null, unite: 'forfait', actif: true, ordre: services.length + 1 }].map((s) => `<tr data-id="${s.id}" data-ordre="${s.ordre}">
      <td><input name="nom" value="${esc(s.nom)}" placeholder="Nouveau service"></td><td><input name="description" value="${esc(s.description || '')}"></td>
      <td><input name="prix" type="number" min="0" step="1" value="${s.prix == null ? '' : s.prix / 100}" placeholder="sur devis" style="text-align:right"></td>
      <td><select name="unite">${choix(s.unite)}</select></td><td><input name="actif" type="checkbox" ${s.actif ? 'checked' : ''} style="width:auto;min-width:0"></td>
      <td><button class="bouton petit" data-a="garder">${s.id ? 'Enregistrer' : 'Ajouter'}</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
  c.querySelectorAll('tr[data-id]').forEach((tr) => tr.querySelector('[data-a=garder]').addEventListener('click', async () => {
    const v = (n) => tr.querySelector(`[name=${n}]`);
    const prix = v('prix').value.trim();
    const ligne = { bien_id: 1, nom: v('nom').value.trim(), description: v('description').value.trim() || null,
      prix: prix === '' ? null : Math.round(Number(prix) * 100), unite: v('unite').value, actif: v('actif').checked, ordre: Number(tr.dataset.ordre) };
    if (!ligne.nom) { message('Donnez un nom au service.', true); return; }
    if (ligne.prix === 0) ligne.prix = null;
    const { error } = tr.dataset.id ? await sb.from('services').update(ligne).eq('id', tr.dataset.id) : await sb.from('services').insert(ligne);
    if (error) { message(error.message, true); return; }
    message('Service enregistré.'); await charger(); ecranServices(c);
  }));
}

// ------------------------------------------------------------ les fiches
function ouvrirSemaine(iso) {
  const r = surSemaine(iso);
  if (r && r.statut !== 'bloquee') return ouvrirResa(r.id);
  const corps = document.getElementById('corps-fiche');
  const sa = saisons.find((x) => x.debut <= iso && iso < x.fin);
  if (r) {
    corps.innerHTML = `<p class="titre-carte">Semaine fermée</p><h2 class="serif" style="font-size:2.2rem">${plage(r.arrivee, r.depart)}</h2>
      <p class="doux" style="margin:10px 0 20px">${esc(r.note_admin || 'Sans motif')}</p>
      <button class="bouton plein" id="rouvrir">Rouvrir ${r.depart > ajoute(r.arrivee, 7) ? 'ces semaines' : 'cette semaine'} à la réservation</button>`;
    corps.querySelector('#rouvrir').addEventListener('click', async () => {
      const { error } = await sb.from('reservations').delete().eq('id', r.id);
      if (error) { message(error.message, true); return; }
      fiche.close(); message('Semaine rouverte.'); await charger(); afficher();
    });
  } else {
    corps.innerHTML = `<p class="titre-carte">Semaine libre</p><h2 class="serif" style="font-size:2.2rem">${plage(iso, ajoute(iso, 7))}</h2>
      <p class="doux" style="margin:10px 0 20px">${sa ? `${esc(sa.nom)}, ${eur(sa.prix_semaine)} la semaine.` : 'Aucun tarif : elle ne peut pas être réservée.'}</p>
      <div class="champ-app"><label for="motif">Motif de fermeture (visible de vous seul)</label><input id="motif" placeholder="Entretien, séjour du propriétaire…"></div>
      <button class="bouton plein" id="fermer-sem" style="margin-top:16px">Fermer cette semaine</button>`;
    corps.querySelector('#fermer-sem').addEventListener('click', async () => {
      const { error } = await sb.from('reservations').insert({ bien_id: 1, arrivee: iso, depart: ajoute(iso, 7), statut: 'bloquee', note_admin: corps.querySelector('#motif').value.trim() || null });
      if (error) { message(/chevauchement/.test(error.message) ? 'Cette semaine vient d’être prise.' : error.message, true); return; }
      fiche.close(); message('Semaine fermée.'); await charger(); afficher();
    });
  }
  fiche.showModal();
}

function ouvrirResa(id) {
  const r = resas.find((x) => x.id === id);
  if (!r) return;
  const corps = document.getElementById('corps-fiche');
  const reste = r.montant_total - paye(r);
  corps.innerHTML = `
    <div class="fiche-pastilles">${etatPaiement(r)}<span class="pastille">${esc(r.reference)}</span></div>
    <h2 class="serif" style="font-size:2.4rem;line-height:1">${nomClient(r)}</h2>
    <p class="doux" style="margin-top:6px">${r.client?.email ? `<a href="mailto:${esc(r.client.email)}">${esc(r.client.email)}</a>` : ''}${r.client?.telephone ? ` · <a href="tel:${esc(r.client.telephone)}">${esc(r.client.telephone)}</a>` : ''}</p>
    <div class="grille-app fiche-colonnes">
      <div><p class="titre-carte">Séjour</p>
        <div class="ligne"><span>Dates</span><span>${plage(r.arrivee, r.depart)}</span></div>
        <div class="ligne"><span>Personnes</span><span>${r.personnes}</span></div>
        <div class="ligne"><span>Séjour</span><span>${eur(r.montant_sejour)}</span></div>
        ${r.reservation_services.map((s) => `<div class="ligne"><span>${esc(s.nom)}, ${qte(s.unite, s.quantite)}</span><span>${eur(s.montant)}</span></div>`).join('')}
        <div class="ligne"><span><b style="font-weight:500">Total</b></span><span class="grand">${eur(r.montant_total)}</span></div>
        <p class="petit gris">Réservée le ${jour(r.cree_le.slice(0, 10))}${r.solde_du_le ? ` · solde dû le ${jour(r.solde_du_le)}` : ''}</p></div>
      <div><p class="titre-carte">Paiements</p>
        ${r.paiements.filter((p) => p.statut === 'paye').map((p) => {
          const f = r.factures.find((x) => x.paiement_id === p.id);
          return `<div class="ligne"><span>${p.type === 'solde' ? 'Solde' : p.type === 'total' ? 'Totalité' : 'Acompte'} · ${jour(p.paye_le.slice(0, 10))}${f ? `<br><button class="lien-bouton petit" data-f="${f.id}">Facture ${esc(f.numero)}</button>` : ''}${p.stripe_session?.startsWith('virement') ? ' <small class="gris">virement</small>' : ''}</span><span>${eur(p.montant)}</span></div>`;
        }).join('') || '<p class="petit doux">Aucun paiement reçu.</p>'}
        <div class="ligne"><span>Reste dû</span><span class="grand">${eur(reste)}</span></div>
        ${reste > 0 && r.statut !== 'annulee' ? `<div class="champ-app" style="margin-top:10px"><label for="virement">Enregistrer un virement reçu (€)</label>
          <div style="display:flex;gap:8px"><input id="virement" type="number" min="1" step="0.01" max="${reste / 100}" value="${reste / 100}"><button class="bouton petit" id="garder-virement">Enregistrer</button></div></div>` : ''}
        ${r.statut === 'confirmee' ? '<button class="lien-bouton petit" id="contrat" style="margin-top:12px">Contrat de location (PDF)</button>' : ''}
      </div>
    </div>
    ${r.client?.masque ? '<p class="petit gris" style="margin-top:14px">Réservation d\'un visiteur de la démonstration : son nom et ses coordonnées ne sont pas montrés dans le compte propriétaire partagé.</p>'
      : r.note_client ? `<p class="titre-carte" style="margin-top:18px">Le mot du client</p><p class="doux">« ${esc(r.note_client)} »</p>` : ''}
    <div class="champ-app" style="margin-top:18px"><label for="note-admin">Note interne</label><textarea id="note-admin" rows="3">${esc(r.note_admin || '')}</textarea></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
      <button class="bouton plein petit" id="garder-note">Enregistrer la note</button>
      ${r.client?.email ? `<a class="bouton contour petit" href="mailto:${esc(r.client.email)}?subject=${encodeURIComponent('Votre séjour ' + r.reference + ' à la Villa Sémaphore')}">Écrire au client</a>` : ''}
      ${r.statut !== 'annulee' ? `<button class="bouton danger petit" id="annuler">Annuler la réservation</button>` : ''}
    </div>
    ${r.statut !== 'annulee' && paye(r) > 0 ? '<p class="petit gris" style="margin-top:10px">Annuler libère les dates. Le remboursement éventuel se fait depuis le tableau de bord Stripe, selon les conditions de location.</p>' : ''}`;

  corps.querySelector('#garder-note').addEventListener('click', async () => {
    const { error } = await sb.from('reservations').update({ note_admin: corps.querySelector('#note-admin').value.trim() || null }).eq('id', r.id);
    if (error) { message(error.message, true); return; }
    message('Note enregistrée.'); await charger();
  });
  corps.querySelector('#annuler')?.addEventListener('click', async () => {
    if (!confirm(`Annuler ${r.reference} ? Les dates redeviennent libres.`)) return;
    const { error } = await sb.from('reservations').update({ statut: 'annulee', expire_le: null }).eq('id', r.id);
    if (error) { message(error.message, true); return; }
    fiche.close(); message('Réservation annulée.'); await charger(); afficher();
  });
  corps.querySelector('#garder-virement')?.addEventListener('click', async () => {
    const montant = Math.round(Number(corps.querySelector('#virement').value) * 100);
    const { error } = await sb.rpc('paiement_manuel', { p_reservation: r.id, p_montant: montant });
    if (error) { message(error.message, true); return; }
    message('Virement enregistré, facture émise.'); await charger(); afficher(); ouvrirResa(r.id);
  });
  const documentPdf = async (quoi, f) => {
    try { const pdf = await import('./pdf.js'); quoi === 'contrat' ? await pdf.contrat(r, r.client) : await pdf.facture(r, f, r.client); }
    catch (e) { console.error(e); message('Le document ne se génère pas.', true); }
  };
  corps.querySelector('#contrat')?.addEventListener('click', () => documentPdf('contrat'));
  corps.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => documentPdf('facture', r.factures.find((x) => x.id === Number(b.dataset.f)))));
  if (!fiche.open) fiche.showModal();
}
