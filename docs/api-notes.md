# Notes API Smartrek H2O (reverse engineering)

## Endpoint : login
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
- Le `sessionId` semble être un UUID v4 généré à chaque nouvelle session/appareil, pas un identifiant fixe.
- Réponse : pas encore capturée en entier — à confirmer la forme exacte (JWT direct dans le body ? `token`/`accessToken` ? refresh token séparé ?).
- ⚠️ Ne jamais committer de vrais identifiants — ils vivent uniquement dans `.env` local (voir `.env.example`), chargé par `src/api/auth.ts`.

## Endpoint : boot
```
POST https://data3.smartrek.io/api/v2/boot
Authorization: Bearer <JWT>
Content-Type: application/json
```
Body (confirmé par capture HAR réelle) : `{ "userId": "<id utilisateur>" }`
— **pas** un body vide comme on l'avait supposé au départ. Le `userId`
s'obtient de façon fiable via `Alarms/get-user-alarm-recipient-groups`
(champ `userId` du premier groupe retourné) — implémenté dans
`src/api/realBoot.ts::ensureUserId()`, mis en cache après le premier appel.
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

## À capturer encore
- [x] Requête de login (structure connue — réponse complète encore à confirmer)
- [ ] Réponse complète de /Account/login (forme exacte du JWT retourné)
- [ ] Requête refreshtoken complète (headers + body + réponse)
- [ ] **Créer une vraie règle d'alarme dans l'app** (seuil sur un capteur) en capturant le réseau — endpoint d'écriture + forme exacte d'une règle
- [ ] **Créer/modifier un groupe de destinataires** — endpoint d'écriture
- [ ] Ouvrir un vrai graphique d'historique pour voir si `Nodes/query` retourne des données (et avec quels paramètres exacts)
- [ ] Détail/historique d'un capteur avec valeurs affichées à l'écran en parallèle (pour calibrer `dats` sur d'autres types que le vide)
