// Réglages publics de l'application. La clé « anon » est faite pour être
// publique : c'est la RLS de la base qui protège les données. Aucun secret
// ici (ni clé service, ni clé Stripe) : ils vivent dans Supabase.
window.VILLA_CONFIG = {
  url: 'https://wgzccaqbrluiifxfgilh.supabase.co',  // le projet Supabase de la démo
  cle: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnemNjYXFicmx1aWlmeGZnaWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTc2OTMsImV4cCI6MjEwNTg3MzY5M30.eALAkBEBigckuOxZmuxZAqIJAleEAO660oqy2ZkYGjw',  // clé anon, publique par nature
  demo: true,       // démonstration : comptes d'essai, inscription sans confirmation, paiements test
  demoAdmin: 'admin@demo.villa-semaphore.fr',
  demoClient: 'client@demo.villa-semaphore.fr',
  demoMotDePasse: 'semaphore2026' // mot de passe public des deux comptes d'essai
};
