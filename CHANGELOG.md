# Changelog

## [1.0.0] — 2025-08-23

### 💥 Highlights
- **App Comets v1 prête à l’usage** (organisation des matchs, gestion membres, actus, notifications, profils).
- **Comets Run – v1.0.0** : version stable (HUD revu, bonus/obstacles, leaderboard, orientation paysage).

### ✨ Nouvelles features
- **Profils**
  - Affichage profil fiable après longue session (refresh session + re‑fetch).
  - Bouton partage réseaux + dernier article (préparé côté site).
- **Actus (Admin)**
  - Notification **à l’insertion uniquement** (pas à l’édition).
- **Matchs (Admin)**
  - Dates au **format FR**.
  - **Auto‑suppression** des matchs passés.
  - Bloc “Ajouter un match” **repliable** (UI compacte).
- **Matchs (Public)**
  - Onglets : **Seniors par défaut**, + 15U, 12U (onglet “Tous” retiré).
  - Quand bouton d’inscription est grisé : affiche **raison claire** + **nb inscrits** visible.
  - Restauration de l’affichage des **matchs joués** (fix import `resultColor/Label`).
- **Jeu – Comets Run (v1.0.0)**
  - Nouveaux obstacles et buffs (coins +100, multiplicateur, bouclier, double saut).
  - Appui court/long pour sauts courts/longs.
  - HUD score centré style Comets, +points affichés près du coin ramassé.
  - Indicateurs à gauche pour bouclier/double saut avec timers.
  - Leaderboard top 5 avec joueur courant mis en valeur.
  - Orientation paysage uniquement pendant le jeu.

### 🛠️ Améliorations / Nettoyage
- Mémoïsations des listes, images optimisées, feedbacks.
- Migration audio planifiée (`expo-av` -> `expo-audio`/`expo-video`).

### 🐞 Corrections
- “Profil vide après longue session” (refresh session).
- Conflits UI bonus/score qui se chevauchaient.
- Erreurs d’imports sur `resultColor/Label`.

### 📦 Build & versioning
- Android `versionCode` ↑ (production).
- iOS `version` alignée.
- EAS profiles **production** prêts.
