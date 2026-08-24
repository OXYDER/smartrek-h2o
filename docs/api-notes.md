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

## À capturer encore
- [x] Requête de login (structure connue — réponse complète encore à confirmer)
- [ ] Réponse complète de /Account/login (forme exacte du JWT retourné)
- [ ] Requête refreshtoken complète (headers + body + réponse)
- [ ] Détail/historique d'un capteur avec valeurs affichées à l'écran en parallèle (pour calibrer `dats`)
- [ ] Requête de modification (seuils, alertes) si elle existe dans l'app d'origine
