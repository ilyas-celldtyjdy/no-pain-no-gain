# No Pain No Gain

Coach de musculation en français : séances générées selon ton objectif, suivi des charges, progression, nutrition et planning. **Gratuit, sans compte, hors ligne** — tes données restent sur ton appareil.

👉 **[Ouvrir l'application](https://ilyas-celldtyjdy.github.io/no-pain-no-gain/)** (installable sur téléphone : « Ajouter à l'écran d'accueil »)

## Fonctionnalités

- Génération de séances (objectif, niveau, zone, matériel, durée) et choix des muscles sur une silhouette
- Charges conseillées d'après tes séances précédentes, minuteur de repos (bip + vibration), écran maintenu allumé pendant la séance
- Progression : courbes, records, score de force, XP / niveaux / succès, récupération musculaire
- Notes par séance et par exercice, séances favorites, « refaire cette séance », suppression annulable
- Nutrition, planning et rappels (notification locale à l'heure prévue)
- Sauvegarde : export / import JSON, export CSV de l'historique

## Données

Tout est stocké dans le `localStorage` du navigateur (clé `coachmuscu.v1`, format versionné avec migrations). Aucune donnée n'est envoyée sur un serveur.
Vider les données du site efface l'historique : **exporte régulièrement une sauvegarde** depuis l'onglet *Joueur*. L'appli demande aussi au navigateur un stockage persistant.

## Structure

```
index.html            page principale
css/style.css         styles
js/data.js            bibliothèque d'exercices et constantes
js/lib.js             fonctions pures (charges, récupération, score, import/export) — testées
js/extras.js          favoris, notes, rappels, écran allumé, hors-ligne
js/app.js             interface et logique de l'application
fonts/                polices Archivo (hébergées localement, licence OFL)
sw.js, manifest.webmanifest, icons/   PWA (installation + mode hors ligne)
tests.html            tests unitaires
```

## Développement

Aucun outil de build. Pour le service worker, servir le dossier en HTTP (le `file://` ne l'active pas) :

```bash
npx serve .          # ou : python -m http.server 8080
```

**Tests :** ouvrir `tests.html` dans le navigateur (32 tests : calculs de charges, récupération, score de force, import, CSV).

**Mise en ligne :** GitHub Pages sert la branche `main`. Après une modification des fichiers, incrémenter `CACHE` dans `sw.js` pour que les utilisateurs récupèrent la nouvelle version.

## Avertissement

Conseils généraux d'entraînement et de nutrition, pas un avis médical. En cas de douleur ou de doute, consulte un professionnel de santé.

## Licence

[MIT](LICENSE). Polices Archivo : SIL Open Font License.
