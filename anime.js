/* Le mouvement du site, en plus de la revelation croquis > photo (site.js).
   Tout repond au defilement, une fois par element, et rien ne tremble :

   - les titres montent ligne par ligne de sous un cache (h1 de l'en-tete,
     h2 et h3 des sections)
   - les paragraphes, points, boutons et lignes des tableaux montent de
     quelques pixels en fondu, en cascade
   - le masque des images s'ouvre avec le defilement (--p, de 1 ferme a 0
     ouvert), puis l'image glisse doucement dans son cadre (--glisse) ;
     tout est lie au scroll, sans inertie
   - la carte se dessine : la cote d'abord, puis les routes, puis les villes
   - les colonnes de la galerie (.colonnes) glissent a des vitesses
     differentes pendant qu'on descend, la page reste libre

   prefers-reduced-motion coupe tout. */
(function(){
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var racine = document.documentElement;
  if (reduce){ racine.classList.add('sans-mouvement'); }
  else racine.classList.add('anime');

  // ------------------------------------------------------------ titres
  // Chaque titre est decoupe en mots, les mots regroupes en lignes selon
  // leur position, et chaque ligne recoit son bloc.
  function decouper(el){
    if (el.dataset.lignes) return;
    var texte = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    texte.forEach(function(mot, i){
      var s = document.createElement('span'); s.className = 'mot'; s.textContent = mot;
      el.appendChild(s);
      if (i < texte.length - 1) el.appendChild(document.createTextNode(' '));
    });
    var mots = [].slice.call(el.querySelectorAll('.mot')), lignes = [], y = null;
    mots.forEach(function(m){
      if (m.offsetTop !== y){ y = m.offsetTop; lignes.push([]); }
      lignes[lignes.length - 1].push(m);
    });
    el.textContent = '';
    lignes.forEach(function(l, i){
      var w = document.createElement('span'); w.className = 'ligne'; w.style.setProperty('--i', i);
      var t = document.createElement('span'); t.className = 'ligne-texte';
      t.textContent = l.map(function(m){ return m.textContent; }).join(' ');
      var b = document.createElement('span'); b.className = 'ligne-bloc';
      w.appendChild(t); w.appendChild(b); el.appendChild(w);
      if (i < lignes.length - 1) el.appendChild(document.createTextNode(' '));
    });
    el.dataset.lignes = lignes.length;
  }

  var titres = [].slice.call(document.querySelectorAll('.entete h1, .corps h2, .corps h3, .nuit h2, .pied-page h2'));
  function preparerTitres(){
    titres.forEach(function(t){
      if (t.classList.contains('vu')) return;
      t.dataset.lignes = ''; decouper(t);
    });
  }

  // ------------------------------------------------------------ apparitions
  var cibles = [].slice.call(document.querySelectorAll(
    '.bloc .texte > p, .bloc .texte > .bouton, .bloc .texte p > .bouton, .bloc .texte p > .lien, table.faits tr, ul.liste li, .coordonnees li, form.demande .champ, form.demande .envoi, figcaption, .colonne > p, .colonne > .bouton, .point, .partenaires, .avis, .bande-nuit .texte > p, .bande-nuit .texte > .bouton, .saisons .tete p, .ligne-carte, .sous, .pied-page .appel p, .pied-page .appel .bouton'
  ));
  cibles.forEach(function(el, i){ el.classList.add('apparait'); });
  // Les elements d'un meme groupe montent en cascade
  document.querySelectorAll('table.faits, ul.liste, .coordonnees, form.demande, .colonne, .cartes').forEach(function(g){
    [].slice.call(g.querySelectorAll('.apparait')).forEach(function(el, i){ el.style.setProperty('--i', i); });
  });

  if (!reduce && 'IntersectionObserver' in window){
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (!e.isIntersecting) return;
        e.target.classList.add('vu');
        obs.unobserve(e.target);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    var lancer = function(){
      preparerTitres();
      titres.concat(cibles).forEach(function(el){ obs.observe(el); });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(lancer); else lancer();
    var tempo;
    addEventListener('resize', function(){
      clearTimeout(tempo);
      tempo = setTimeout(function(){
        titres.forEach(function(t){ if (!t.classList.contains('vu')){ t.textContent = t.textContent; t.dataset.lignes = ''; decouper(t); } });
      }, 200);
    });
  } else {
    titres.concat(cibles).forEach(function(el){ el.classList.add('vu'); });
  }

  // ------------------------------------------------------------ carte
  var carte = document.querySelector('.carte');
  if (carte){
    carte.querySelectorAll('path').forEach(function(p){
      var l = p.getTotalLength(); p.style.strokeDasharray = l + ' ' + l; p.style.strokeDashoffset = l;
    });
    if (reduce) carte.classList.add('vu');
    else new IntersectionObserver(function(entries, o){
      entries.forEach(function(e){ if (e.isIntersecting){ carte.classList.add('vu'); o.disconnect(); } });
    }, { threshold: 0.3 }).observe(carte);
  }

  // ------------------------------------------------------------ masque, parallaxe et colonnes
  // Tout ce qui suit lit la position a l'ecran a chaque image et pose des
  // variables CSS, sans transition : ce qui bouge suit le doigt au pixel.
  var images = reduce ? [] : [].slice.call(document.querySelectorAll('.corps .dessin, .entete .dessin')).filter(function(d){ return !d.closest('.colonnes'); });
  var masques = images.filter(function(d){ return !d.closest('.entete'); });
  var grille = document.querySelector('.colonnes');
  var cols = (reduce || !grille) ? [] : [].slice.call(grille.querySelectorAll('.col'));
  function lisse(p){ return p * p * (3 - 2 * p); }

  var derniere = -1;
  function tick(){
    requestAnimationFrame(tick);
    var y = scrollY;
    if (y === derniere) return;
    derniere = y;
    var H = innerHeight;
    images.forEach(function(d){
      var r = d.getBoundingClientRect();
      if (r.bottom < -100 || r.top > H + 100) return;
      // -1 quand l'image entre par le bas, +1 quand elle sort par le haut
      var t = (r.top + r.height / 2 - H / 2) / (H / 2 + r.height / 2);
      d.style.setProperty('--glisse', (-t * 4).toFixed(2) + '%');
    });
    masques.forEach(function(d){
      var r = d.getBoundingClientRect();
      if (r.top > H + 100) return;   // pas encore la : reste ferme
      // ferme (1) quand le haut de l'image est a 92 % de l'ecran, ouvert (0) a 42 %,
      // et ouvert au-dessus, pour une page rechargee a mi-hauteur
      var p = Math.min(1, Math.max(0, (r.top - H * 0.42) / (H * 0.5)));
      d.style.setProperty('--p', lisse(p).toFixed(4));
    });
    if (cols.length){
      var g = grille.getBoundingClientRect();
      if (g.bottom > -200 && g.top < H + 200){
        // -1 quand la grille entre par le bas, +1 quand elle sort par le haut
        var tg = (g.top + g.height / 2 - H / 2) / (H / 2 + g.height / 2);
        // Sur telephone les colonnes sont deux et la page est etroite :
        // a 90 px la premiere remontait par-dessus la legende
        var amplitude = innerWidth < 700 ? 30 : 90;
        cols.forEach(function(c){
          var v = parseFloat(c.dataset.vitesse) || 0;
          c.style.transform = 'translate3d(0,' + (tg * v * amplitude).toFixed(1) + 'px,0)';
        });
      }
    }
  }
  if (images.length || cols.length) tick();
})();
