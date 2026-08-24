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

### ⚠️ Note de sécurité — identifiants Smartrek dans le bundle

Vite fige les variables `VITE_*` dans le JS livré au navigateur au moment du
build. Concrètement, l'email/mot de passe Smartrek utilisés pour le login
seront extractibles par quiconque ouvre les DevTools sur le site déployé.
C'est acceptable seulement si l'accès au site est lui-même restreint (auth
basique ou allowlist IP sur Nginx Proxy Manager — voir plus bas). Une vraie
correction plus tard serait un petit backend qui garde les identifiants
côté serveur et n'expose au client qu'un token de session.

### 1. Stack Portainer (build depuis le repo Git)

Dans Portainer → **Stacks → Add stack → Repository** :
- Repository URL : `https://github.com/OXYDER/smartrek-h2o`
- Reference : `refs/heads/main`
- Compose path : `docker-compose.yml`
- Environment variables (dans Portainer, pas dans le repo) :
  - `VITE_SMARTREK_EMAIL`
  - `VITE_SMARTREK_PASSWORD`
  - `VITE_SMARTREK_API_BASE` (optionnel, défaut déjà bon)
- **GitOps updates** : active le polling automatique (ex. toutes les 5 min)
  ou configure un webhook GitHub → Portainer pour un redéploiement immédiat
  à chaque push.

Le conteneur écoute sur le port hôte `8091` (ajustable dans
`docker-compose.yml` si déjà pris sur ton NAS).

### 2. Nginx Proxy Manager

Nouveau **Proxy Host** :
- Domain : `h2o.resotik.ca`
- Forward to : IP interne du NAS, port `8091`
- SSL : demande un certificat Let's Encrypt, force HTTPS
- **Access List** : configure une auth basique (ou une allowlist IP) tant
  que les identifiants Smartrek sont dans le bundle client — voir la note
  de sécurité ci-dessus.

### 3. DNS

Pointe `h2o.resotik.ca` (enregistrement A ou CNAME selon ta config actuelle
pour resotik.ca) vers l'IP publique de ton NAS / ton tunnel existant.

### Boucle de dev : tester après chaque push

Une fois le webhook Portainer configuré, le flux devient : je push sur
`main` → Portainer détecte le changement → rebuild + redeploy automatique
→ `h2o.resotik.ca` reflète le dernier commit en quelques minutes, sans rien
faire de ton côté.
