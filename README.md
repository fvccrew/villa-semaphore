# Villa Sémaphore

Démonstration [Weboost Studio](https://weboost-studio.fr) : le site d'une villa
d'exception du golfe de Saint-Tropez, dont la page d'accueil est une visite au
défilement.

**Voir le site : https://fvccrew.github.io/villa-semaphore/**

## La villa n'existe pas

Elle est modélisée en 3D par script, rendue image par image, et tout ce qu'on
voit en sort : la visite, les photos des pages, et les dessins d'architecte qui
se transforment en photographies pendant le vol d'approche. Aucune image de
banque, aucun lieu réel.

C'est le point de la démonstration : produire pour un client un site dont la
matière visuelle est unique, même quand il n'y a rien à photographier.

## Ce que la page d'accueil fait

Au chargement, un dessin au trait se trace à l'écran. En descendant, le dessin
prend ses ombres, puis ses couleurs, et la villa devient une photographie
pendant que la caméra arrive depuis la mer, franchit la porte, traverse le
salon et s'arrête au bord du bassin. La visite terminée, le site arrive
dessous, sur la même page.

La caméra ne tremble pas et rien ne joue de son : tout suit le défilement, dans
un sens comme dans l'autre.

## Comment c'est fait

- **Blender**, piloté en Python, rendu Cycles sur GPU : la villa, le terrain,
  la végétation et le chemin de caméra sont écrits en code, pas modelés à la
  main. 220 images pour la visite
- Le même script rend une **seconde passe en dessin au trait**, avec la même
  caméra : c'est ce qui permet au croquis de se superposer à la photo au pixel
- **Stable Diffusion XL avec ControlNet profondeur**, en local, pour pousser
  les rendus vers la photographie sans déplacer la géométrie
- La page est du **HTML, CSS et JavaScript sans bibliothèque** : un canvas qui
  dessine la bonne image selon la position de défilement, et des images WebP

## Contenu de ce dépôt

Le site seul, tel qu'il est publié. La modélisation, les scripts de rendu et
les images sources vivent ailleurs, ils pèsent plus d'un gigaoctet.

Villa imaginaire. Les prix, les disponibilités et les coordonnées affichés sont
fictifs, le formulaire n'envoie rien.
