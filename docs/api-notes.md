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

### Format du champ `dats` (32 octets décodés)
- Octets 0–7 : timestamp Unix en **millisecondes**, `uint64 little-endian` — confirmé identique au champ `timestamp`
- Octets 8–31 : payload de lecture(s), format encore à calibrer. `0xff9c` (little-endian) apparaît comme valeur sentinelle probable pour "canal inutilisé/pas de donnée".
- TODO : comparer avec les valeurs affichées dans l'UI pour un capteur donné afin de déduire l'échelle/l'unité par canal.

## À capturer encore
- [x] Requête de login (structure connue — réponse complète encore à confirmer)
- [ ] Réponse complète de /Account/login (forme exacte du JWT retourné)
- [ ] Requête refreshtoken complète (headers + body + réponse)
- [ ] Détail/historique d'un capteur avec valeurs affichées à l'écran en parallèle (pour calibrer `dats`)
- [ ] Requête de modification (seuils, alertes) si elle existe dans l'app d'origine
