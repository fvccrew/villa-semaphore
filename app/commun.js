// Ce que partagent les trois écrans : le client Supabase, les formats
// (euros, dates), la connexion, le bandeau de démo, les messages.
//
// Les dates circulent en texte ISO « 2027-07-10 » et se calculent en UTC :
// un samedi reste un samedi quel que soit le fuseau du visiteur.

export const C = window.VILLA_CONFIG || {};
export const pret = !!(C.url && C.cle && window.supabase);
export const sb = pret
  ? window.supabase.createClient(C.url, C.cle, { auth: { persistSession: true, storageKey: 'villa-semaphore-session' } })
  : null;

// ------------------------------------------------------------ formats
const fmtEur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtEurCt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
// Instrument Serif n'a pas l'espace fine insécable que met Intl : on la
// remplace par l'insécable ordinaire, que les deux polices connaissent
export const eur = (c) => (c == null ? 'sur devis' : (c % 100 ? fmtEurCt : fmtEur).format(c / 100).replace(/\u202f/g, '\u00a0'));

export const enDate = (iso) => { const [a, m, j] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, j)); };
export const enIso = (d) => d.toISOString().slice(0, 10);
export const ajoute = (iso, jours) => { const d = enDate(iso); d.setUTCDate(d.getUTCDate() + jours); return enIso(d); };
export const ecart = (a, b) => Math.round((enDate(b) - enDate(a)) / 86400000);
export const aujourdhui = () => { const n = new Date(); return enIso(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))); };
const f = (iso, o) => enDate(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC', ...o });
export const jour = (iso) => f(iso, { day: 'numeric', month: 'long', year: 'numeric' });
export const jourSemaine = (iso) => f(iso, { weekday: 'long', day: 'numeric', month: 'long' });
export const court = (iso) => f(iso, { day: 'numeric', month: 'short' });
export const moisNom = (iso) => { const s = f(iso, { month: 'long' }); return s[0].toUpperCase() + s.slice(1); };
export const plage = (a, d) => {
  const ma = a.slice(0, 7) === d.slice(0, 7);
  return `${ma ? enDate(a).getUTCDate() : court(a)} → ${jour(d)}`;
};
export const heure = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
export const initiales = (nom) => (nom || '?').split(/\s+/).filter((m) => /^\p{L}/u.test(m)).slice(0, 2).map((m) => m[0].toUpperCase()).join('') || '?';

// Échappe tout texte venu de la base avant de le poser dans du HTML
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const STATUT = { attente_paiement: 'En attente de paiement', confirmee: 'Confirmée', annulee: 'Annulée', bloquee: 'Fermée' };
export const UNITE = { forfait: '', jour: 'la journée', heure: "l'heure", seance: 'la séance', repas: 'par personne et par dîner' };
export const QUANTITE = { forfait: ['', ''], jour: ['jour', 'jours'], heure: ['heure', 'heures'], seance: ['séance', 'séances'], repas: ['dîner', 'dîners'] };
export const qte = (u, n) => (u === 'forfait' ? 'demandé' : `${n} ${QUANTITE[u][n > 1 ? 1 : 0]}`);

// Les photos de la villa, par saison ou par usage
export const PHOTO = { 'Été': 'planches/f0204.webp', 'Printemps': 'planches/terrasse.webp', 'Automne': 'planches/bassin.webp', 'Hors saison': 'planches/salon.webp' };

// ------------------------------------------------------------ petits outils d'interface
export function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

let minuteur;
export function message(texte, mauvais = false) {
  let t = document.querySelector('.toast');
  if (!t) { t = el('<div class="toast" role="status" aria-live="polite"></div>'); document.body.appendChild(t); }
  t.textContent = texte; t.classList.toggle('mauvais', mauvais); t.classList.add('voir');
  clearTimeout(minuteur); minuteur = setTimeout(() => t.classList.remove('voir'), 4200);
}

// L'erreur d'une fonction Edge arrive dans un objet Response
export async function erreurDe(error) {
  try { const j = await error.context.json(); if (j?.erreur) return j.erreur; } catch { /* rien */ }
  return error?.message || 'Une erreur est survenue';
}

export function bandeauDemo(avant) {
  if (!C.demo) return;
  const b = el(`<p class="bandeau-demo"><b>Démonstration.</b> Données fictives remises à zéro chaque nuit. Paiements en mode test : carte <b>4242 4242 4242 4242</b>, une date future, n'importe quel code.</p>`);
  avant.parentNode.insertBefore(b, avant);
}

export function nonConfigure(conteneur) {
  conteneur.innerHTML = `<div class="carte-app" style="max-width:640px;margin:40px auto"><p class="titre-carte">Bientôt</p>
    <h2>L'application n'est pas encore branchée.</h2><p class="doux" style="margin-top:12px">La base de données de la villa n'est pas encore en ligne. Revenez dans quelques jours, ou écrivez à la conciergerie depuis la page <a href="contact.html">contact</a>.</p></div>`;
}

// ------------------------------------------------------------ la session
export async function session() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function profil() {
  const s = await session();
  if (!s) return null;
  const { data } = await sb.from('profils').select('*').eq('id', s.user.id).single();
  return data ? { ...data, email: s.user.email } : null;
}

// Le lien du compte dans la barre : initiales quand on est connecté
export async function lienCompte() {
  const a = document.querySelector('.barre .rond.moi');
  if (!a) return;
  const p = await profil();
  if (p) {
    a.href = p.role === 'admin' ? 'admin.html' : 'compte.html';
    a.setAttribute('aria-label', p.role === 'admin' ? 'Administration' : 'Mon compte');
    a.innerHTML = `<span class="initiales">${esc(initiales(p.nom))}</span><span class="nom-lien">${p.role === 'admin' ? 'Admin' : 'Mon compte'}</span>`;
  }
}

export async function deconnexion(ou = 'compte.html') { await sb.auth.signOut(); location.href = ou; }

// Le panneau de connexion : comptes d'essai en démo, e-mail et mot de passe,
// création de compte (sauf sur l'écran du propriétaire), mot de passe oublié
// hors démo. En démo, le compte s'ouvre sans e-mail de confirmation et ne
// demande pas de téléphone. apres(profil) est appelé une fois connecté.
export function panneauConnexion(conteneur, { apres, titre = 'Votre espace', role } = {}) {
  let mode = 'connexion';
  const inscriptionPossible = role !== 'admin';
  const rendre = () => {
    const inscription = mode === 'inscription';
    const basculer = inscription
      ? 'Déjà un compte ? <button type="button" class="lien-bouton" data-mode="connexion">Se connecter</button>'
      : [inscriptionPossible ? 'Pas encore de compte ? <button type="button" class="lien-bouton" data-mode="inscription">Créer un compte</button>' : '',
         C.demo ? '' : '<button type="button" class="lien-bouton" data-mode="oubli">Mot de passe oublié</button>'].filter(Boolean).join(' · ');
    conteneur.innerHTML = `
      <h1>${inscription ? 'Créer un compte' : esc(titre)}</h1>
      ${C.demo && !inscription ? `<div class="demo-choix">
        ${role !== 'admin' ? `<button class="bouton plein" type="button" data-demo="client"><span>Essayer en client<small style="color:#b9b9b3">Anne Delorme, un séjour d'été réservé</small></span><span class="fleche"><svg viewBox="0 0 12 12"><path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5"/></svg></span></button>` : ''}
        ${role !== 'client' ? `<button class="bouton contour" type="button" data-demo="admin"><span>Essayer en propriétaire<small>le planning, les réservations, les tarifs</small></span><span class="fleche" style="background:var(--encre);color:#fff"><svg viewBox="0 0 12 12"><path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5"/></svg></span></button>` : ''}
        <p class="petit gris">Comptes d'essai : ${esc(C.demoClient)} et ${esc(C.demoAdmin)}, mot de passe ${esc(C.demoMotDePasse)}.</p>
      </div><div class="separe">ou avec une adresse</div>` : ''}
      <form class="champs" novalidate>
        ${inscription ? `<div class="champ-app"><label for="c-nom">Nom et prénom</label><input id="c-nom" name="nom" autocomplete="name" required></div>
          ${C.demo ? '' : '<div class="champ-app"><label for="c-tel">Téléphone</label><input id="c-tel" name="telephone" type="tel" autocomplete="tel"></div>'}` : ''}
        <div class="champ-app"><label for="c-email">Adresse e-mail</label><input id="c-email" name="email" type="email" autocomplete="email" required></div>
        <div class="champ-app"><label for="c-mdp">Mot de passe</label><input id="c-mdp" name="mdp" type="password" autocomplete="${inscription ? 'new-password' : 'current-password'}" minlength="8" required></div>
        <p class="erreur" aria-live="polite"></p>
        <button class="bouton plein large" type="submit"><span>${inscription ? 'Créer mon compte' : 'Se connecter'}</span><span class="fleche"><svg viewBox="0 0 12 12"><path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5"/></svg></span></button>
        ${C.demo && inscription ? `<p class="petit gris">Démonstration : votre compte s'ouvre tout de suite, sans e-mail de confirmation. Le compte propriétaire, partagé par tous les visiteurs, ne voit ni votre nom ni votre adresse. Votre compte et vos réservations sont effacés sous 48 heures.</p>` : ''}
        ${basculer ? `<p class="petit doux">${basculer}</p>` : ''}
      </form>`;

    const erreur = conteneur.querySelector('.erreur');
    const occupe = (b, oui) => b && b.classList.toggle('occupe', oui);
    conteneur.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', async () => {
      occupe(b, true);
      const email = b.dataset.demo === 'admin' ? C.demoAdmin : C.demoClient;
      const { error } = await sb.auth.signInWithPassword({ email, password: C.demoMotDePasse });
      occupe(b, false);
      if (error) { erreur.textContent = "Le compte d'essai ne répond pas, réessayez dans un instant."; return; }
      apres(await profil());
    }));
    conteneur.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', async () => {
      if (b.dataset.mode === 'oubli') {
        const email = conteneur.querySelector('#c-email').value.trim();
        if (!email) { erreur.textContent = "Indiquez d'abord votre adresse e-mail."; return; }
        await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL('compte.html', location.href).href });
        message('Si un compte existe, un lien vient de partir par e-mail.');
        return;
      }
      mode = b.dataset.mode; rendre();
    }));
    conteneur.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      if (!form.reportValidity()) return;
      const bouton = form.querySelector('[type=submit]');
      const email = form.email.value.trim(), password = form.mdp.value;
      erreur.textContent = ''; occupe(bouton, true);
      const { error } = inscription
        ? await sb.auth.signUp({ email, password, options: { data: { nom: form.nom.value.trim(), telephone: form.telephone?.value.trim() || null } } })
        : await sb.auth.signInWithPassword({ email, password });
      occupe(bouton, false);
      if (error) {
        erreur.textContent = /invalid login/i.test(error.message) ? 'Adresse ou mot de passe incorrect.'
          : /already registered/i.test(error.message) ? 'Un compte existe déjà avec cette adresse.'
          : /password/i.test(error.message) ? 'Le mot de passe doit compter au moins 8 caractères.'
          : error.message;
        return;
      }
      if (inscription && !(await session())) { message('Compte créé : confirmez votre adresse depuis le lien reçu par e-mail.'); return; }
      apres(await profil());
    });
  };
  rendre();
}
