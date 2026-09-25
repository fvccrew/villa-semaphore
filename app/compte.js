// L'espace client : le prochain séjour, ce qui reste à payer, les services,
// les documents, les autres séjours, le profil. Au retour de Stripe
// (?paiement=ok), on attend que le webhook ait confirmé le paiement.
import {
  sb, pret, C, eur, ajoute, aujourdhui, ecart, jour, plage, heure, esc, el, message, erreurDe,
  bandeauDemo, nonConfigure, session, profil, lienCompte, deconnexion, panneauConnexion, STATUT, qte, PHOTO,
} from './commun.js';

const zone = document.getElementById('zone');
const params = new URLSearchParams(location.search);
let moi, resas = [], onglet = 'sejours', choisi = null;

bandeauDemo(zone);
if (!pret) nonConfigure(zone); else demarrer();

async function demarrer() {
  if (!(await session())) return accueil();
  moi = await profil();
  if (moi?.role === 'admin' && !params.has('client')) { location.replace('admin.html'); return; }
  await charger();
  // Au retour de Stripe, le séjour qu'on vient de payer passe en grand
  choisi = resas.find((r) => r.reference === params.get('ref'))?.id ?? null;
  afficher();
  lienCompte();
  if (params.get('paiement') === 'ok') attendreConfirmation();
}

function accueil() {
  zone.innerHTML = `<section class="connexion">
    <div class="photo-connexion"><img src="planches/terrasse.webp" alt=""><p>Votre séjour, vos documents, votre solde : tout est ici.</p></div>
    <div class="carte-app" id="panneau"></div></section>`;
  panneauConnexion(zone.querySelector('#panneau'), { titre: 'Votre espace', apres: () => location.reload() });
}

async function charger() {
  const { data, error } = await sb.from('reservations')
    .select('*, reservation_services(*), paiements(*), factures(*)')
    .order('arrivee');
  if (error) { message('Vos séjours ne se chargent pas, rechargez la page.', true); return; }
  resas = data;
}

const paye = (r) => r.paiements.filter((p) => p.statut === 'paye').reduce((s, p) => s + p.montant, 0);
const saisonDe = (iso) => { const m = Number(iso.slice(5, 7)); return m === 7 || m === 8 ? 'Été' : m >= 4 && m <= 6 ? 'Printemps' : m >= 9 && m <= 10 ? 'Automne' : 'Hors saison'; };
const enAttenteValide = (r) => r.statut === 'attente_paiement' && new Date(r.expire_le) > new Date();
const actives = () => resas.filter((r) => r.statut === 'confirmee' || enAttenteValide(r));

function afficher() {
  const prenom = (moi?.nom || '').split(' ')[0];
  zone.innerHTML = `
    ${avisRetour()}
    <div class="salut"><h1>Bonjour${prenom ? ' ' + esc(prenom) : ''}.</h1>
      <div class="onglets" role="tablist">
        <button role="tab" data-o="sejours" aria-selected="${onglet === 'sejours'}">Mes séjours</button>
        <button role="tab" data-o="profil" aria-selected="${onglet === 'profil'}">Profil</button>
        <a class="bouton contour petit" href="reserver.html">Réserver une autre semaine</a>
        <button class="bouton contour petit" id="sortir" type="button">Se déconnecter</button>
      </div></div>
    <div id="contenu"></div>`;
  zone.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('click', () => { onglet = b.dataset.o; afficher(); }));
  zone.querySelector('#sortir').addEventListener('click', () => deconnexion());
  if (onglet === 'profil') return ecranProfil();
  ecranSejours();
}

function avisRetour() {
  const p = params.get('paiement');
  if (p === 'ok') return `<p class="avis-paiement" id="avis">Merci, Stripe a bien reçu votre paiement. La confirmation s'affiche dans quelques secondes…</p>`;
  if (p === 'annule') return `<p class="avis-paiement annule">Paiement interrompu, rien n'a été débité. Vous pouvez le reprendre ci-dessous tant que vos dates sont gardées.</p>`;
  return '';
}

function ecranSejours() {
  const c = zone.querySelector('#contenu');
  const auj = aujourdhui();
  const avenir = actives().filter((r) => r.depart >= auj);
  const visibles = resas.filter((r) => r.statut !== 'bloquee' && !(r.statut === 'attente_paiement' && !enAttenteValide(r)));
  const prochain = visibles.find((r) => r.id === choisi) || avenir[0];
  const autres = visibles.filter((r) => r !== prochain);

  if (!prochain) {
    c.innerHTML = `<div class="grande-carte"><img src="planches/f0204.webp" alt=""><div class="dessus">
      <span class="pastille sur-photo" style="align-self:flex-start">Aucun séjour à venir</span>
      <div><p class="serif" style="font-size:clamp(2.4rem,1.8rem + 3vw,4.4rem);line-height:.95">La mer vous attend.</p>
      <a class="bouton clair" style="margin-top:18px" href="reserver.html">Choisir une semaine <span class="fleche"><svg viewBox="0 0 12 12"><path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5"/></svg></span></a></div></div></div>
      ${autres.length ? `<div class="carte-app" style="margin-top:14px"><p class="titre-carte">Vos séjours</p>${autres.map(ligneSejour).join('')}</div>` : ''}`;
    brancher(c);
    return;
  }

  const r = prochain;
  const j = ecart(auj, r.arrivee);
  const reste = r.montant_total - paye(r);
  const enRetard = r.statut === 'confirmee' && reste > 0 && r.solde_du_le && r.solde_du_le < auj;
  const surPlace = j <= 7;
  c.innerHTML = `
    <div class="grille-app deux" style="margin-top:0">
      <div class="grande-carte"><img src="${PHOTO[saisonDe(r.arrivee)]}" alt=""><div class="dessus">
        <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="pastille sur-photo ${r.statut}">${STATUT[r.statut]}</span><span class="pastille sur-photo">${esc(r.reference)}</span></div>
        <div><span class="j">${r.depart < auj ? 'Passé' : j > 0 ? 'J − ' + j : r.arrivee <= auj ? 'Sur place' : 'Aujourd’hui'}</span>
        <p style="margin-top:12px">Du ${jour(r.arrivee)} au ${jour(r.depart)} · ${r.personnes} personne${r.personnes > 1 ? 's' : ''}</p></div></div></div>
      <div class="pile">
        <div class="carte-app"><p class="titre-carte">Paiements</p>
          ${r.paiements.filter((p) => p.statut === 'paye').sort((a, b) => a.paye_le.localeCompare(b.paye_le)).map((p) =>
            `<div class="ligne"><span>${p.type === 'solde' ? 'Solde' : p.type === 'total' ? 'Séjour réglé' : 'Acompte'}, payé le ${jour(p.paye_le.slice(0, 10))}</span><span>${eur(p.montant)}</span></div>`).join('')}
          ${r.statut === 'attente_paiement' ? `<div class="ligne"><span>${r.acompte < r.montant_total ? 'Acompte' : 'Séjour'} à régler avant ${heure(r.expire_le)}</span><span class="grand">${eur(r.acompte)}</span></div>
            <button class="bouton plein" data-payer="${r.id}" style="margin-top:10px">Payer ${eur(r.acompte)}</button>`
          : reste > 0 && r.depart >= auj ? `<div class="ligne"><span>Solde, ${enRetard ? `<b style="color:#9a3b1f">attendu depuis le ${jour(r.solde_du_le)}</b>` : `dû le ${jour(r.solde_du_le)}`}</span><span class="grand">${eur(reste)}</span></div>
            <button class="bouton plein" data-payer="${r.id}" style="margin-top:10px">Payer le solde · ${eur(reste)}</button>`
          : `<div class="ligne"><span>Tout est réglé</span><span class="pastille solde">Soldé</span></div>`}
        </div>
        <div class="carte-app"><p class="titre-carte">Vos services</p>
          ${r.reservation_services.length ? r.reservation_services.map((s) =>
            `<div class="ligne"><span>${esc(s.nom)}, ${qte(s.unite, s.quantite)}</span><span>${eur(s.montant)}</span></div>`).join('')
            : '<p class="petit doux">Aucun service pour l’instant. La conciergerie en ajoute sur simple appel.</p>'}
        </div>
      </div>
    </div>
    <div class="grille-app trois">
      <div class="carte-app"><p class="titre-carte">Documents</p>${documents(r) || '<p class="petit doux">Le contrat et les factures apparaissent ici dès le premier paiement.</p>'}</div>
      <div class="carte-app"><p class="titre-carte">Avant d'arriver</p>
        <p class="petit">${surPlace
          ? `L'adresse : <b>Route de Gigaro, 83420 La Croix-Valmer</b>. Le code du portail vous est envoyé par message le matin de l'arrivée.`
          : `L'adresse exacte et le code du portail vous sont envoyés la semaine de l'arrivée.`}
        Arrivée le samedi à partir de 16 h, départ le samedi avant 10 h. La conciergerie répond de 8 h à minuit au <a href="tel:+33494000000">04 94 00 00 00</a>.</p>
        ${r.note_client ? `<p class="petit doux" style="margin-top:10px">Votre mot : « ${esc(r.note_client)} »</p>` : ''}</div>
      <div class="carte-app"><p class="titre-carte">Vos autres séjours</p>
        ${autres.length ? autres.map(ligneSejour).join('') : '<p class="serif" style="font-size:1.5rem">Aucun pour l’instant</p><p class="petit gris">Ce sera votre premier séjour à la villa.</p>'}</div>
    </div>`;
  brancher(c);
}

function documents(r) {
  const liens = [];
  if (r.statut === 'confirmee') liens.push(`<button class="doc" data-doc="contrat" data-r="${r.id}"><i>PDF</i><span>Contrat de location<small>${esc(r.reference)}</small></span></button>`);
  for (const f of [...r.factures].sort((a, b) => a.numero.localeCompare(b.numero))) {
    liens.push(`<button class="doc" data-doc="facture" data-r="${r.id}" data-f="${f.id}"><i>PDF</i><span>Facture ${esc(f.numero)}<small>${eur(f.montant)}, acquittée le ${jour(f.emise_le.slice(0, 10))}</small></span></button>`);
  }
  return liens.join('');
}

// Un autre séjour, en une ligne : un clic l'affiche en grand
function ligneSejour(r) {
  const reste = r.montant_total - paye(r);
  return `<button class="sejour-liste" type="button" data-voir="${r.id}"><img src="${PHOTO[saisonDe(r.arrivee)]}" alt="">
    <span><b style="font-weight:500">${plage(r.arrivee, r.depart)}</b><br><small class="gris">${esc(r.reference)} · ${eur(r.montant_total)}${reste > 0 && r.statut === 'confirmee' && r.depart >= aujourdhui() ? ` · reste ${eur(reste)}` : ''}</small></span>
    <span class="pastille ${r.statut}">${r.depart < aujourdhui() && r.statut === 'confirmee' ? 'Passé' : STATUT[r.statut]}</span></button>`;
}

function brancher(c) {
  c.querySelectorAll('[data-voir]').forEach((b) => b.addEventListener('click', () => {
    choisi = Number(b.dataset.voir); afficher(); scrollTo({ top: 0, behavior: 'smooth' });
  }));
  c.querySelectorAll('[data-payer]').forEach((b) => b.addEventListener('click', () => payer(Number(b.dataset.payer), b)));
  c.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', async () => {
    const r = resas.find((x) => x.id === Number(b.dataset.r));
    b.classList.add('occupe');
    try {
      const pdf = await import('./pdf.js');
      if (b.dataset.doc === 'contrat') await pdf.contrat(r, moi);
      else await pdf.facture(r, r.factures.find((f) => f.id === Number(b.dataset.f)), moi);
    } catch (e) { console.error(e); message('Le document ne se génère pas, réessayez.', true); }
    b.classList.remove('occupe');
  }));
}

async function payer(id, bouton) {
  bouton.classList.add('occupe');
  const { data, error } = await sb.functions.invoke('paiement', { body: { reservation: id, retour: location.href.split('?')[0] } });
  if (error || !data?.url) { bouton.classList.remove('occupe'); message(error ? await erreurDe(error) : 'Le paiement ne répond pas.', true); return; }
  location.href = data.url;
}

// Le webhook de Stripe arrive en général en une à trois secondes
async function attendreConfirmation() {
  const ref = params.get('ref');
  for (let i = 0; i < 20; i++) {
    const r = resas.find((x) => x.reference === ref);
    const paiementOk = r && r.paiements.some((p) => p.statut === 'paye' && Date.now() - new Date(p.paye_le) < 15 * 60000);
    if (paiementOk) {
      const f = [...r.factures].sort((a, b) => b.id - a.id)[0];
      history.replaceState(null, '', 'compte.html');
      params.delete('paiement');
      afficher();
      message(`Paiement confirmé${f ? ', facture ' + f.numero + ' disponible' : ''}.`);
      return;
    }
    await new Promise((ok) => setTimeout(ok, 1500));
    await charger();
  }
  const a = document.getElementById('avis');
  if (a) a.textContent = 'Votre paiement est bien reçu par Stripe, sa confirmation prend un peu plus de temps que prévu. Rechargez la page dans une minute.';
}

function ecranProfil() {
  const c = zone.querySelector('#contenu');
  c.innerHTML = `<div class="grille-app deux" style="margin-top:0">
    <form class="carte-app champs" id="f-profil" novalidate>
      <p class="titre-carte">Vos coordonnées</p>
      <div class="champ-app"><label for="p-nom">Nom et prénom</label><input id="p-nom" name="nom" autocomplete="name" value="${esc(moi.nom)}" required></div>
      <div class="champ-app"><label for="p-tel">Téléphone</label><input id="p-tel" name="telephone" type="tel" autocomplete="tel" value="${esc(moi.telephone || '')}"></div>
      <div class="champ-app"><label>Adresse e-mail</label><input value="${esc(moi.email)}" disabled></div>
      <p class="erreur"></p>
      <button class="bouton plein" type="submit" ${moi.demo ? 'disabled' : ''}>Enregistrer</button>
      ${moi.demo ? '<p class="petit gris">Le compte d’essai ne se modifie pas.</p>' : ''}
    </form>
    <form class="carte-app champs" id="f-mdp" novalidate>
      <p class="titre-carte">Mot de passe</p>
      <div class="champ-app"><label for="p-mdp">Nouveau mot de passe</label><input id="p-mdp" name="mdp" type="password" autocomplete="new-password" minlength="8" required></div>
      <p class="erreur"></p>
      <button class="bouton contour" type="submit" ${moi.demo ? 'disabled' : ''}>Changer le mot de passe</button>
      <p class="petit gris">Vos données : nom, e-mail, téléphone et séjours, gardés le temps de la relation puis archivés comme la loi le demande pour les factures. <a href="confidentialite.html">En savoir plus</a>.</p>
    </form></div>`;
  c.querySelector('#f-profil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.reportValidity()) return;
    const { error } = await sb.from('profils').update({ nom: f.nom.value.trim(), telephone: f.telephone.value.trim() || null }).eq('id', moi.id);
    if (error) { f.querySelector('.erreur').textContent = error.message; return; }
    moi = await profil(); message('Coordonnées enregistrées.'); lienCompte();
  });
  c.querySelector('#f-mdp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.reportValidity()) return;
    const { error } = await sb.auth.updateUser({ password: f.mdp.value });
    if (error) { f.querySelector('.erreur').textContent = error.message; return; }
    f.reset(); message('Mot de passe changé.');
  });
}
