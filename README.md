# Smartrek Manager

Interface de remplacement pour gérer les capteurs Smartrek H2O — CRUD complet
(capteurs, seuils d'alerte, canaux de notification), sans l'UI Web 2.0
d'origine.

Actuellement branchée sur des données **mock** (en mémoire) pour que tu
puisses valider l'UX avant de connecter le vrai backend.

## Lancer le projet

```bash
npm install
npm run dev
```

Ouvre `http://localhost:5173`.

## Brancher la vraie API Smartrek H2O

Toute la logique d'accès aux données est isolée dans **`src/api/client.ts`**.
Chaque méthode (`listSensors`, `updateSensor`, `upsertThreshold`, etc.) a un
commentaire `TODO(réel)` qui indique l'endpoint probable à appeler. Les
composants ne connaissent jamais les détails du transport — tu peux remplacer
le contenu de ces méthodes sans toucher au reste de l'app.

### Étapes

1. **Capturer les requêtes réelles** : connecte-toi sur
   `app3.smartrekh2o.com`, ouvre DevTools → Network → filtre Fetch/XHR, et
   navigue dans les écrans équivalents (liste capteurs, détail, modif de
   seuil). Note l'URL, la méthode, les headers d'auth et le body de chaque
   requête (clic droit → *Copy as cURL* est le plus rapide).

2. **Identifier le type d'auth** (cookie de session, JWT, clé API custom) et
   décider comment le stocker :
   - Si Smartrek H2O autorise le CORS depuis un autre domaine → tu peux
     appeler l'API directement depuis le navigateur avec `fetch()` et un
     token stocké côté client (moins sécurisé, mais plus simple).
   - Sinon, il faudra un petit proxy serveur (Express/Vercel function) qui
     relaie les requêtes avec les identifiants stockés en variable
     d'environnement — pattern classique pour scraper une app tierce sans
     exposer les credentials au navigateur.

3. **Remplacer le mock** dans `client.ts`, méthode par méthode. Exemple pour
   `listSensors` :

   ```ts
   async listSensors(siteId?: string): Promise<Sensor[]> {
     const res = await fetch(`${API_BASE}/sensors${siteId ? `?siteId=${siteId}` : ''}`, {
       headers: { Authorization: `Bearer ${getToken()}` },
     })
     const raw = await res.json()
     return raw.map(mapRawSensorToSensor) // à écrire selon le shape réel
   }
   ```

   Tu devras probablement écrire une petite fonction `mapRawSensorToSensor`
   pour transformer le format de Smartrek H2O vers le type `Sensor` défini
   dans `src/types/sensor.ts` (ajuste ce type librement une fois que tu
   connais le vrai schéma).

## Structure

```
src/
  types/sensor.ts       — modèle de données (Sensor, ThresholdRule, AlertChannel, Site)
  api/client.ts         — couche d'accès aux données (à brancher sur l'API réelle)
  api/mockData.ts        — jeu de données fictif pour le dev
  components/            — SensorCard, SensorDetailPanel (CRUD), NewSensorModal, Sidebar
  pages/Dashboard.tsx    — assemblage : grille + filtres + panneau de détail
```

## Design

Thème sombre façon panneau de contrôle/instrumentation, teinté acériculture :
fond quasi-noir, accent "sève" (cyan-vert) pour le direct, accent "sirop"
(ambre) pour les avertissements. Police Fraunces pour les titres, Inter pour
l'UI, IBM Plex Mono pour les lectures numériques.

## Déploiement (NAS Synology / Portainer / Nginx Proxy Manager)

Même pattern que les autres projets : Docker via Portainer, reverse proxy via
Nginx Proxy Manager, GitHub pour le versioning.

L'app se connecte à Smartrek H2O via un écran de login au runtime (tes
identifiants sont saisis dans le navigateur, jamais compilés dans le code ni
committés) — le build Docker n'a donc besoin d'aucun secret.

### Build automatique via GitHub Actions

À chaque push sur `main`, `.github/workflows/docker-build.yml` build l'image
et la publie sur GitHub Container Registry (GHCR) :
`ghcr.io/oxyder/smartrek-h2o:latest`. Le NAS n'a donc plus besoin de builder
lui-même — Portainer se contente de **puller** l'image déjà prête.

**Étape unique à faire une fois** : après le premier run du workflow (visible
dans l'onglet **Actions** du repo GitHub), va dans **github.com/OXYDER →
Packages → smartrek-h2o → Package settings** et passe la visibilité à
**Public**. Comme ça, Portainer peut puller l'image sans jamais avoir besoin
d'identifiants — aucun token à saisir, ni maintenant ni plus tard.

### 1. Stack Portainer

Dans Portainer → **Stacks → Add stack** :
- Build method : **Web editor** (plus besoin de lier le repo Git — l'image
  est déjà construite ailleurs)
- Colle le contenu de `docker-compose.yml`
- **Deploy the stack**

Pour mettre à jour après un nouveau push : dans le détail du stack →
**Pull and redeploy** — ça va chercher la dernière image `latest` sur GHCR et
redémarrer le conteneur. Prend quelques secondes, pas de build sur le NAS.

Le conteneur écoute sur le port hôte `8091` (ajustable dans
`docker-compose.yml` si déjà pris sur ton NAS).

### 2. Nginx Proxy Manager

Nouveau **Proxy Host** :
- Domain : `h2o.resotik.ca`
- Forward to : IP interne du NAS, port `8091`
- SSL : demande un certificat Let's Encrypt, force HTTPS
- Une auth basique reste une bonne idée pour un outil interne (évite qu'un
  visiteur externe tombe sur l'écran de login), mais n'est plus une
  nécessité de sécurité comme avant.

### 3. DNS

Pointe `h2o.resotik.ca` (enregistrement A ou CNAME selon ta config actuelle
pour resotik.ca) vers l'IP publique de ton NAS / ton tunnel existant.

### Boucle de dev : tester après chaque push

Je push sur `main` → GitHub Actions build + publie l'image sur GHCR
(1-2 minutes) → tu cliques **Pull and redeploy** dans Portainer (ou on
configure le polling GitOps de Portainer sur le registre pour que ce soit
automatique aussi) → `h2o.resotik.ca` reflète le dernier commit.
