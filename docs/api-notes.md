# Notes API Smartrek H2O (reverse engineering)

## Endpoint : login (réponse complète confirmée ✓)
```
POST https://data3.smartrek.io/api/Account/login
Content-Type: application/json
```
Body :
```json
{
  "email": "<email du compte>",
  "domain": "<identique à email observé>",
  "password": "<mot de passe>",
  "sessionId": "<uuid généré côté client, ex crypto.randomUUID()>"
}
```
Réponse :
```json
{
  "user": { "_id": "...", "email": "...", "firstName": "...", "lastName": "..." },
  "domain": { "...": "même forme que user" },
  "jwtToken": "eyJ...",
  "refreshToken": "...",
  "sessionId": "...",
  "expiresIn": "15m"
}
```
- Le JWT expire après **~15 minutes** — renouvellement obligatoire.
- `user._id` = le `userId` requis par `/boot` (voir plus bas), pas besoin
  d'appel séparé pour l'obtenir.
- ⚠️ Ne jamais committer de vrais identifiants — ils vivent uniquement
  dans l'écran de login au runtime.

## Endpoint : refreshtoken (renouvellement, réponse complète confirmée ✓)
```
POST https://data3.smartrek.io/api/Account/refreshtoken
Content-Type: application/json
```
Body : `{ "token": "<refreshToken>", "sessionId": "<sessionId>" }`
Réponse : **même forme que login** (nouveau `jwtToken` + `refreshToken` +
`expiresIn`) — donc le cycle se répète indéfiniment tant que l'app reste
ouverte. Implémenté dans `src/api/auth.ts` : renouvellement automatique
programmé à 80% de la durée de vie du token, avec persistance de la
session dans `sessionStorage` (survit à un F5, pas à la fermeture de
l'onglet).

## Endpoint : boot
```
POST https://data3.smartrek.io/api/v2/boot
Authorization: Bearer <JWT>
Content-Type: application/json
```
Body (confirmé par capture HAR réelle) : `{ "userId": "<id utilisateur>" }`
— **pas** un body vide comme on l'avait supposé au départ. Le `userId`
vient directement de `user._id` dans la réponse de login/refreshtoken
(voir plus haut) — pas d'appel réseau supplémentaire nécessaire.
- CORS : `Access-Control-Allow-Origin: https://app3.smartrekh2o.com` (donc restreint à ce domaine — un proxy sera probablement nécessaire pour appeler depuis notre propre app)
- Réponse : `{ nodes: [ { table, activeNode, smartgateway, smartgateway_global_status, softwareVersion, xmlcreated_tstamp, row_items: [...] } ] }`

### row_items (un item par capteur/gateway)
| champ | type | notes |
|---|---|---|
| id | number | identifiant unique |
| type | number | `5` = passerelle (gateway), `0` = capteur |
| mac | string | adresse MAC-like, ex `0.1.117.122` |
| name | string | nom affiché, éditable par l'utilisateur |
| serialNumber | string | ex `SKALD003-25460001N-0029` |
| latitude / longitude | number | **entier = degré × 1e6** (ex 46373692 → 46.373692°) |
| dats | string (base64) | payload binaire, voir ci-dessous |
| status | number | 0 observé jusqu'ici |
| timestamp | string | timestamp ms (dupliqué dans `dats`) |

### Contexte physique — capteurs de vide

Les capteurs de vide (`vacuum`) existent en modèles à **1, 2 ou 3 ports**,
chaque port connectant une ligne de tubulure 5/16" de sève et lisant son
propre taux de vide. Chaque appareil inclut aussi une sonde de
température intégrée — donc un capteur 3 ports = 4 canaux (3 vide + 1
température), un capteur 1 port = 2 canaux (1 vide + 1 température).

Deuxième code sentinelle découvert : quand un port n'existe pas
**physiquement** sur le modèle (ex. canaux 2/3 d'un appareil 1 port), la
valeur lue est `32000` brut (`0x7D00`) → affichée `320.00`, distincte de
la sentinelle `0xFF9C`/-100 vue ailleurs pour les canaux non câblés.
Confirmé sur `extracteur`/`13`/`14` (1 port actif, canaux 2-3 à 320.00) et
`15 +niche` (2 ports actifs, canal 3 à 320.00).

⚠️ Le **nom du capteur** suit le(s) numéro(s) de ligne(s) de tubulure
branchée(s), pas la capacité physique du boîtier. `1-2-3` = un boîtier
3 ports avec les lignes 1, 2 et 3 branchées sur ses 3 ports. `13` et `14`
= chacun un boîtier modèle **double port**, mais avec une seule des deux
lignes effectivement branchée — d'où un seul canal actif malgré la
capacité 2 ports du matériel. Le nombre de ports *actifs* dans `dats` ne
dit donc rien sur la capacité du boîtier, seulement sur ce qui est
effectivement câblé à ce moment.

### Format du champ `dats` (décodage validé ✓)

Confirmé en comparant les valeurs décodées aux valeurs affichées dans
l'app d'origine, pour 4 capteurs réels (site « Cabane », capteurs
1-2-3, 4-5-6, 7-8-9, 10-11-12) :

| Octets | Contenu |
|---|---|
| 0-7 | Timestamp Unix ms (`uint64` little-endian) — confirmé identique au champ `timestamp` |
| 8 | `0x00` fixe — fonction inconnue |
| 9 | Variable — fonction inconnue (pas une lecture) |
| 10-11 | Canal 1 — `int16 LE / 100` |
| 12-13 | Canal 2 (température sur les capteurs testés) — `int16 LE / 100` |
| 14 | Variable — fonction inconnue |
| 15-16 | Canal 3 — `int16 LE / 100` |
| 17-18 | Canal 4 — `int16 LE / 100` |
| 19+ | Canaux additionnels non utilisés sur ces capteurs, par blocs de 4 octets (`int16` sentinelle `0xFF9C` = -100 + 2 octets à 0) |
| 3 derniers octets | Trailer constant observé (`a9 e1 0c`) — fonction inconnue, ignoré |

⚠️ Le **type** de chaque canal (vide, température, débit...) n'est pas
encodé dans `dats` — il dépend du modèle physique du capteur
(`serialNumber`). Sur les capteurs testés (vide + température),
canal 1/3/4 = pression (inHg), canal 2 = température (°C). Cette
correspondance canal↔type devra être confirmée pour d'autres types de
capteurs (débit, niveau, etc.) au fur et à mesure qu'on en capture.

Implémenté dans `src/api/decodeDats.ts`.

## Endpoint : v2/refresh (polling léger)
```
POST https://data3.smartrek.io/api/v2/refresh
Authorization: Bearer <JWT>
```
Body : `{ "userId": "<id utilisateur>" }`
Réponse : même forme que `/boot` (`nodes[]` + `differentials`). C'est
l'endpoint utilisé pour le **polling en direct** — appelé en boucle
(observé ~toutes les 5s dans une session réelle) pour garder l'UI à jour
sans refaire un `/boot` complet à chaque fois. Le `userId` s'obtient du
profil utilisateur (visible aussi dans la réponse de
`get-user-alarm-recipient-groups`, champ `userId`).

## Endpoint : Nodes/query (historique — partiellement compris)
```
POST https://data3.smartrek.io/api/Nodes/query
```
Body : `{ "start": <ms>, "end": <ms>, "macs": [<id capteur>] }` — malgré
le nom `macs`, ce sont en fait les **id numériques des capteurs** (pas
des adresses MAC).
Réponse observée : `{ "<id>": "" }` — vide dans les deux essais capturés
(plage de 24h). Soit ce compte n'a pas d'historique stocké pour cette
période, soit il manque un paramètre. À retester en ouvrant un vrai
graphique d'historique dans l'app avec Network ouvert.

## Endpoints : Alarms/* (seuils & notifications — lecture confirmée, écriture à capturer)

```
POST https://data3.smartrek.io/api/Alarms/get-user-alarm-rules
```
Body `{}` → `{ "alarmRules": [] }` — vide sur ce compte (aucune règle
configurée), donc la forme exacte d'une règle reste à voir.

```
POST https://data3.smartrek.io/api/Alarms/get-user-alarm-recipient-groups
```
Body `{}` → tableau de groupes de destinataires **partagés** (pas un
canal de notif par capteur comme on l'avait supposé) :
```json
{
  "_id": "...", "userId": "...", "name": "Default",
  "email": ["info@..."], "phone": [],
  "days": [0,1,2,3,4,5,6], "afterTime": 0, "beforeTime": 23,
  "timezone": "Canada/Eastern", "isMainGroup": true
}
```
⚠️ Ça remet en question notre modèle `notificationChannels` par capteur.
La vraie architecture semble être : des **groupes de destinataires**
nommés (avec fenêtre horaire/jours actifs) que des **règles d'alarme**
référencent ensuite (règle = capteur + canal + seuil + groupe à notifier).
À confirmer une fois qu'on capture une vraie règle.

```
POST https://data3.smartrek.io/api/Alarms/get-user-alarm-activities-with-limit
```
Body `{ "limit": 10, "skip": 1 }` → `{ "alarmActivities": [] }` —
journal paginé des alarmes déclenchées, vide ici.

### Autres types de nœuds découverts

En plus de `type: 5` (passerelle) et `type: 0` (capteur de vide) :

- **`type: 1`** — capteur de **niveau/bassin** (ex. `Bassin S3`,
  `Bassin Lapierre`). Payload de 24 octets, entièrement décodé (voir plus
  bas).
- **`type: 2`** — « A-Link Valve » — le vrai **contrôle à distance**, 2
  canaux relais (`Channel 1`/`Channel 2`, interrupteur on/off dans
  l'app). Un seul exemple capturé (`status: 3` = « Dead node » — et
  `rest[0]` du `dats` vaut aussi `3`, même pattern que le vide/niveau où
  le premier octet reflète le statut). Les 2 canaux à `0`/éteint — pas
  assez de variation pour repérer les octets qui encodent leur état, ni
  pour trouver une éventuelle batterie (formule `×4-261` testée sur tout
  le payload de 37 octets, aucun candidat plausible — probablement une
  électrovanne alimentée sur secteur, sans batterie). Bloqué tant qu'on
  n'a pas un exemple avec au moins un canal allumé.
- **`type: 10`** — **répéteur radio** (relais réseau, ex. `répét 1`),
  pas un capteur de mesure. Payload de 11 octets.

### Niveau de bassin (`type: 1`) — payload décodé, mais pas de lecture live

Grâce à l'écran de détail natif de l'app (batterie + config de
calibration affichées ensemble), le payload de 24 octets est
entièrement compris :

| Octets (absolu) | Contenu | Formule |
|---|---|---|
| 0-7 | Timestamp Unix ms | `uint64 LE` |
| 13 | **Batterie** | `octet × 4 − 261` (même formule que le vide, décalée d'1 octet) |
| 14-15 | Calibration du zéro (in) | `int16 LE / 10` |
| 16-17 | Niveau élevé (= le "max" affiché, in) | `int16 LE / 10` |
| 18-19 | Niveau en avertissement (in) | `int16 LE / 10` |
| 20-21 | Niveau en priorité (in) | `int16 LE / 10` |
| 22-23 | Niveau bas (in) | `int16 LE / 10` (`-1` = non configuré) |

Validé sur **6 échantillons** (`S3`, `S4`, `Lapierre`, `station`, `h20`,
`Concentré`, avec des plages/max complètement différents) : le "max"
matche parfaitement sur les 6, et les 5 valeurs de config + batterie de
S3/S4 matchent exactement contre l'écran natif de l'app.

**Conclusion définitive : ce `dats` ne contient QUE la
configuration/calibration, jamais la lecture de niveau actuelle.**
Recherche exhaustive (LE/BE, toutes les échelles) sur les 6 échantillons
: aucun octet ne correspond au niveau affiché (`6.3 in`, `3.0 in`, etc.)
dans aucun cas. L'écran natif de l'app confirme lui-même « Aucune donnée
récente disponible » pour ces bassins — la valeur affichée est
probablement une dernière lecture mise en cache côté serveur, pas
dérivable depuis `/boot`. Dossier fermé sauf nouvelle piste externe (un
autre endpoint qui la retournerait séparément), ou un capteur de niveau
**actif** à capturer pour voir si le payload change une fois en ligne.

Implémenté : `decodeBatteryPercent(dats, 13)`. La config (seuils) n'est
pas branchée dans l'app — pas de cas d'usage clair identifié pour
l'instant (ce sont les seuils de Smartrek eux-mêmes, pas les nôtres).

### Batterie des capteurs de vide — formule

```
batterie% = octet[14] × 4 − 261
```

Validé sur 4 capteurs réels avec la valeur affichée à l'écran en
parallèle (`1`→79%, `2`→79%, `12-13-14`→75%, `23-24`→71%) — match exact
sans arrondi. C'était l'octet pris pour une « constante protocolaire
~78-86 » tout au début de l'exploration.

⚠️ Répéteurs (`type: 10`, 11 octets) : tentative de calibration sur 3
échantillons — `rest[2]` (82, 82, 77) donne bien 67% pour les deux
appareils à 82, mais la pente calculée entre 82→67% et 77→46% n'est pas
un nombre entier propre (4.2), suspect comparé au `×4 - 261` net du
vide. Pas implémenté — mieux vaut un 4e point de calibration qu'une
formule probablement fausse.

Implémenté dans `src/api/decodeDats.ts::decodeBatteryPercent()`.

### Correction — numérotation des ports par position fixe (bug)

Découvert sur de vraies données en tableau : tous les capteurs
« Vacuum double » (2 ports) affichaient leurs valeurs comme `Port 1` et
`Port 3` — jamais `Port 1`/`Port 2`. Notre étiquetage d'origine assignait
un nom fixe par position dans le payload (index 0 → Port 1, index 2 →
Port 2, index 3 → Port 3), en supposant qu'un appareil 2 ports utilise
toujours les positions 0 et 2. En réalité, les appareils 2 ports
utilisent les positions **0 et 3** (pas 0 et 2) — la position 2 reste
inactive/sentinelle pour ce modèle.

Corrigé en numérotant les ports **dans l'ordre où ils apparaissent
actifs** plutôt que par position fixe — robuste peu importe l'arrangement
réel, y compris pour les appareils à plus de 3 ports (ex. `Vacuum
Cabane`, 5 ports actifs).

## Fonctionnalité locale — différentiel de vide, par port

Configurable individuellement pour **chaque port de chaque capteur** —
pas un seul réglage par capteur. Sur chaque port de vide dans le panneau
de détail, un lien « + Différentiel » (ou « ▸ Différentiel (vs X · Y) »
une fois configuré) permet de choisir directement un port de référence
dans une **liste plate de tous les ports de tous les autres capteurs**
(pas un choix en deux étapes capteur puis port), puis une alarme min/max
sur l'écart. L'écart s'affiche entre parenthèses à côté de la valeur du
port sur les cartes, le tableau, et le détail. Implémenté dans
`src/lib/differential.ts` ; la config vit sur le `SensorChannel`
lui-même (`differential: PortDifferentialConfig`), pas sur le `Sensor`.

## Fonctionnalité locale — Alarmes (seuil + notification fusionnés)

Les anciennes sections séparées « Seuils » (par canal) et
« Notifications » (au niveau du capteur entier) sont fusionnées en une
seule section « Alarmes » **par port** : chaque alarme = un seuil
min/max + à qui notifier (SMS/courriel/push + destinataire), configurés
ensemble via « + Alarme ». `ThresholdRule` porte maintenant un champ
optionnel `notification`. Le `Sensor.notificationChannels` global a été
retiré — les notifications n'existent plus qu'au niveau de chaque
alarme de port.

## Fonctionnalité locale — carte des passerelles et des capteurs

Deux niveaux, tous les deux via le bouton `🗺 Carte` (dans la sidebar
pour la vue globale, ou dans la barre de filtres quand un site est
sélectionné) :

- **Vue globale** (aucun site sélectionné) : chaque passerelle comme
  marqueur, clique → bascule vers ce site.
- **Vue par site** : tous les capteurs de ce site (+ la passerelle
  elle-même) comme marqueurs individuels, en utilisant les coordonnées
  GPS propres à chaque capteur (`latitude`/`longitude` du `row_item`,
  jamais utilisées avant — seule la passerelle l'était). Chaque marqueur
  utilise l'icône du type de capteur fournie par le client (vide,
  niveau, contrôle à distance, répéteur), colorée selon le statut
  (lime/rouge/orange). Info-bulle au survol avec nom, type, et lecture
  clé (ports vide, température, batterie). Respecte les filtres actifs
  (recherche, catégorie, statut) — la carte par site affiche exactement
  ce que la liste afficherait avec les mêmes filtres.

Carte : Leaflet, 3 fonds gratuits sans clé API (contrairement à Google
Maps utilisé par l'app Smartrek d'origine) — Rues (OpenStreetMap),
Satellite (Esri World Imagery), Terrain (OpenTopoMap), sélecteur natif
Leaflet en haut à droite. Le filtre sombre ne s'applique qu'aux tuiles
Rues (`.map-inverted`, basculé en JS selon la couche active — inverser
une image satellite donnerait n'importe quoi). Logique partagée dans
`src/lib/mapLayers.ts`. Capteurs sans coordonnées propres : simplement
absents de la carte par site, avec un compte affiché en dessous.

Clic sur un pin de capteur (carte par site) : le **panneau de détail
complet** (canaux, alarmes, différentiel, notes, suppression — tout,
pas un résumé) apparaît **sous la carte, dans le flux normal de la
page** — pas en fenêtre modale par-dessus tout. `SensorDetailPanel`
accepte maintenant une prop `inline` qui retire le voile/overlay plein
écran pour ce cas précis.

## À capturer encore
- [x] Requête de login (structure connue — réponse complète encore à confirmer)
- [ ] Réponse complète de /Account/login (forme exacte du JWT retourné)
- [ ] Requête refreshtoken complète (headers + body + réponse)
- [ ] **Créer une vraie règle d'alarme dans l'app** (seuil sur un capteur) en capturant le réseau — endpoint d'écriture + forme exacte d'une règle
- [ ] **Créer/modifier un groupe de destinataires** — endpoint d'écriture
- [ ] Ouvrir un vrai graphique d'historique pour voir si `Nodes/query` retourne des données (et avec quels paramètres exacts)
- [ ] Détail/historique d'un capteur avec valeurs affichées à l'écran en parallèle (pour calibrer `dats` sur d'autres types que le vide)
- [x] **Batterie** : `octet[14] × 4 − 261`, validé sur 4 capteurs réels
- [ ] Formule batterie pour les répéteurs (`type: 10`) — structure de payload différente
- [ ] Décoder le `dats` du type `1` (Bassin/niveau, 24 octets) avec une valeur affichée en parallèle
- [x] Type `10` (répéteur) inclus dans l'UI (compté mais dans aucune catégorie nommée)
- [ ] Décoder l'état des 2 canaux relais du contrôle à distance (`type: 2`) — besoin d'un exemple avec un canal allumé
