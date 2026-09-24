/* Les pages de la villa : chaque figure .dessin porte un croquis et une
   photo de la meme camera. Quand la figure entre a l'ecran, la classe .vu
   lance la revelation (site.css). Une seule fois par figure.

   La barre du haut est fixe et suit le fond qu'elle survole : encre sur
   le croquis (body.papier) et sur les sections claires (body.sur-clair),
   blanche sur la photo et sur les bandes sombres. Chaque section porte
   data-fond="clair" ou "sombre" ; la derniere dans l'ordre du document qui
   couvre la hauteur de la barre l'emporte. */
(function(){
  // ?h=900 fixe la hauteur d'ecran de l'en-tete : pour les captures headless
  // en page longue, ou 100svh vaut toute la page
  var h = parseInt(new URLSearchParams(location.search).get('h'), 10);
  if (h > 0) document.documentElement.style.setProperty('--ecran', h + 'px');

  var fonds = [].slice.call(document.querySelectorAll('[data-fond]')), surClair = false;
  var visite = document.querySelector('.visite');
  // Passe l'en-tete, la barre s'efface quand on descend et revient des
  // qu'on remonte, pour ne pas passer sur les textes
  var dernierY = scrollY, cachee = false;
  function fond(){
    var y = 44, quoi = '';
    for (var i = 0; i < fonds.length; i++){
      var r = fonds[i].getBoundingClientRect();
      if (r.top <= y && r.bottom >= y) quoi = fonds[i].dataset.fond;
    }
    var c = quoi === 'clair';
    if (c !== surClair){ surClair = c; document.body.classList.toggle('sur-clair', surClair); }
    // Le dernier ecran de la visite remonte avec la page et passe
    // derriere la barre : sur telephone, le titre et la pilule finissaient
    // dans les pilules du haut. On efface la barre pendant le passage.
    var passage = false;
    if (visite){
      var v = visite.getBoundingClientRect();
      passage = v.bottom < innerHeight - 8 && v.bottom > -80;
    }
    var cache = passage || (quoi !== '' && scrollY > dernierY + 4);
    var montre = !passage && (scrollY < dernierY - 4 || quoi === '');
    if (cache && !cachee){ cachee = true; document.body.classList.add('barre-cachee'); }
    else if (montre && cachee){ cachee = false; document.body.classList.remove('barre-cachee'); }
    if (Math.abs(scrollY - dernierY) > 4) dernierY = scrollY;
  }
  if (fonds.length){ addEventListener('scroll', fond, { passive: true }); addEventListener('resize', fond); fond(); }

  var figures = [].slice.call(document.querySelectorAll('.dessin'));
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var entete = document.querySelector('.entete');
  function revele(){
    if (entete) entete.classList.add('vu');
    document.body.classList.add('revele');
    document.body.classList.remove('papier');
  }
  if (reduce || !('IntersectionObserver' in window)){
    figures.forEach(function(f){ f.classList.add('vu'); });
    revele();
    return;
  }
  // On observe le cadre parent (figure) plutot que l'image : fermee par son
  // clip-path avant la revelation, l'image compte pour invisible et
  // l'observateur ne se declencherait jamais
  var cibles = new Map();
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if (!e.isIntersecting) return;
      var f = cibles.get(e.target) || e.target;
      // On attend que la photo soit chargee, sinon le lavis arrive vide
      var photo = f.querySelector('.photo');
      var go = function(){
        f.classList.add('vu');
        if (f.closest('.entete')) revele();
      };
      if (photo && !photo.complete) photo.addEventListener('load', go, { once: true }); else go();
      obs.unobserve(e.target);
    });
  }, { threshold: 0.35 });
  figures.forEach(function(f){
    // Dans les colonnes de la galerie, chaque figure se revele pour elle-meme
    var cible = f.closest('.colonnes') ? f : (f.closest('.image, .carte-semaine, .espaces > figure') || f.parentElement || f);
    cibles.set(cible, f); obs.observe(cible);
  });
})();

// Demonstration : le formulaire n'a pas de serveur derriere lui (le site est
// statique). Sans interception, un clic sur Envoyer recharge la page et donne
// l'impression d'un site casse. On repond sur place a la place.
(function(){
  var f = document.querySelector('form.demande');
  if (!f) return;
  f.addEventListener('submit', function(e){
    e.preventDefault();
    var note = f.querySelector('.note');
    if (!note) return;
    if (!f.checkValidity()){ f.reportValidity(); return; }
    note.textContent = 'Merci. Cette villa est une d\u00e9monstration : la demande n\u2019est pas envoy\u00e9e. Sur un site en production, elle arriverait dans votre bo\u00eete mail.';
    note.classList.add('note-repondu');
  });
})();

// ------------------------------------------------------------- le menu
// Sur telephone, les pages ne tiennent pas en pilules : un bouton ouvre un
// panneau pleine page, les titres en grand comme le reste du site, chacun
// avec ce qu'on y trouve. Construit ici a partir de la nav, pour que les
// cinq pages restent identiques et qu'il n'y ait qu'un endroit a corriger.
(function(){
  var barre = document.querySelector('.barre');
  var nav = barre && barre.querySelector('nav');
  var droite = barre && barre.querySelector('.droite');
  if (!nav || !droite) return;

  // Ce qu'on trouve derriere chaque page, dit en quelques mots
  var SOUS = {
    './': 'Le survol, la porte, le bassin',
    'villa.html': '320 m² sur la roche, la galerie',
    'prestations.html': 'Conciergerie, chef, cave',
    'situation.html': 'Gigaro, le golfe, les temps de route',
    'contact.html': 'Demander des dates'
  };

  var liens = [].slice.call(nav.querySelectorAll('a'));
  var bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'menu-bouton';
  bouton.setAttribute('aria-label', 'Ouvrir le menu');
  bouton.setAttribute('aria-expanded', 'false');
  bouton.setAttribute('aria-controls', 'menu-tel');
  bouton.innerHTML = '<span class="traits" aria-hidden="true"><i></i><i></i></span>';
  droite.appendChild(bouton);

  var panneau = document.createElement('div');
  panneau.className = 'menu-panneau';
  panneau.id = 'menu-tel';
  panneau.hidden = true;
  var html = '<div class="menu-dedans"><nav class="menu-pages" aria-label="Pages">';
  liens.forEach(function(a){
    var href = a.getAttribute('href');
    var ici = a.hasAttribute('aria-current') ? ' aria-current="page"' : '';
    html += '<a href="' + href + '"' + ici + '><span class="titre">' + a.textContent +
      '</span><span class="sous">' + (SOUS[href] || '') + '</span></a>';
  });
  html += '</nav><div class="menu-pied">' +
    '<a class="menu-tel" href="tel:+33494000000">04 94 00 00 00</a>' +
    '<a class="menu-mail" href="mailto:contact@villa-semaphore.fr">contact@villa-semaphore.fr</a>' +
    '<p class="menu-lieu">Route de Gigaro, La Croix-Valmer</p>' +
    '</div></div>';
  panneau.innerHTML = html;
  document.body.appendChild(panneau);

  var ouvert = false, yGarde = 0;
  function ouvrir(){
    if (ouvert) return;
    ouvert = true;
    yGarde = scrollY;
    panneau.hidden = false;
    // deux images d'attente, sinon la transition part du mauvais etat
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      document.body.classList.add('menu-ouvert');
    }); });
    bouton.setAttribute('aria-expanded', 'true');
    bouton.setAttribute('aria-label', 'Fermer le menu');
    // la page ne doit pas defiler derriere le panneau
    document.body.style.position = 'fixed';
    document.body.style.top = -yGarde + 'px';
    document.body.style.width = '100%';
    var premier = panneau.querySelector('a');
    if (premier) premier.focus({ preventScroll: true });
  }
  function fermer(rendre){
    if (!ouvert) return;
    ouvert = false;
    document.body.classList.remove('menu-ouvert');
    bouton.setAttribute('aria-expanded', 'false');
    bouton.setAttribute('aria-label', 'Ouvrir le menu');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    scrollTo(0, yGarde);
    setTimeout(function(){ if (!ouvert) panneau.hidden = true; }, 420);
    if (rendre) bouton.focus({ preventScroll: true });
  }
  bouton.addEventListener('click', function(){ ouvert ? fermer(true) : ouvrir(); });
  panneau.addEventListener('click', function(e){
    // un lien vers la page ou l'on est deja ne rechargera rien : on ferme
    if (e.target.closest('a')) fermer(false);
  });
  addEventListener('keydown', function(e){ if (e.key === 'Escape') fermer(true); });
  // tourner le telephone en grand ecran laisse le panneau ouvert pour rien
  addEventListener('resize', function(){ if (ouvert && innerWidth > 700) fermer(false); });
})();
