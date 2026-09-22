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
    var cache = quoi !== '' && scrollY > dernierY + 4;
    var montre = scrollY < dernierY - 4 || quoi === '';
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
    note.textContent = 'Merci. Cette villa est une demonstration : la demande n\u2019est pas envoyee. Sur un site en production, elle arriverait dans votre boite mail.';
    note.classList.add('note-repondu');
  });
})();
