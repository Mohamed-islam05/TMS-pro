# RUNTIME TEST REPORT — Server Actions `/dashboard/charges` (DEV vs PROD)

## Résumé exécutif (verdict)

**🟢 Les Server Actions de `/dashboard/charges` FONCTIONNENT en DEV et en PROD**, avec des entrées valides : les créations, modifications et suppressions de charges s'exécutent et persistent en base, les règles métier (dossier CLOTURÉ → refus) sont correctement appliquées.

Le « bug de suppression » qui semblait avoir été reproduit plus tôt est **réfuté par les tests propres de cette session**. Son origine a été tracée avec certitude :

1. **Artefact du harnais de test** : dans `runtests.ps1`, `Run-Test` fait `Write-Output "TEST …"` **et** `return $dataId`. En PowerShell, `Write-Output` pollue la valeur de retour → le corps envoyé à `deleteCharge` était
   `[{"id":"TEST createCharge-GENERALE | HTTP 200 | … | dataId=d83ed3f2-… | => PASS d83ed3f2-…"}]`
   c'est-à-dire un **ID invalide** (pas un UUID).
2. Ceci déclenche légitimement un `ZodError: "ID invalide"` dans `deleteChargeSchema.parse(data)` (`src/lib/actions/charges.ts:114`).
3. Le `catch` de l'action le récupère, mais **`console.error(…, zodError)` plante sous Node v24.11.1** dans le formateur `node:internal/util/inspect` (`TypeError: Cannot read properties of undefined (reading 'value')`), ce qui :
   - masque l'erreur réelle dans les logs serveur,
   - transforme la réponse normale `{ success:false, error:"…" }` en **flight `1:E` / erreur 500** côté client.

## Environnement

| Élément | Valeur |
|---|---|
| OS / shell | Windows, PowerShell 5.1 |
| Node | **v24.11.1** |
| npm | 11.6.2 |
| Next.js | 14.2.35 |
| @prisma/client | 5.22.0 (SQLite `file:./dev.db`) |
| next-auth | 4.24.15 (JWT, cookie `next-auth.session-token`) |
| zod | 3.25.76 |
| Auth utilisée | admin@tms.com / admin123 (csrf + callback credentials) |
| Entreprise | `67344a6a-…` ; dossier OUVERT `31adfbe0-…` ; dossier CLOTURÉ `c9ff49ab-…` |
| Actions testées | getAllCharges, getDossiers, getChargesByDossier, createCharge, updateCharge, deleteCharge (IDs `49fb562e…`, `f6c4fa50…`, `61fc24e5…`, `6b01a4ac…`, `644c3382…`, `cd18db4e…`) |

## Méthodologie

- **Aucune modification du projet** (aucun fix, aucun workaround) — preuve runtime uniquement.
- POST Server Action HTTP brut : URL = page, headers `Next-Action`, `Content-Type: text/plain;charset=UTF-8`, `Accept: text/x-component`, `Origin` ; réponse flight ligne `1:{…}` (succès) ou `1:E{…}` (erreur).
- **DEUX** exécutions : serveur `npm run dev` (port 3000) et build `npm run build` (EXIT 0) + `next start`.
- Un re-tir du crash `console.error` a été fait **hors Next** (Node 24 pur) pour isoler la cause, et un serveur DEV avec `console.error` assaini (`NODE_OPTIONS=--require preload.js`) a permis de révéler l'erreur d'origine que le crash masquait.

## Résultats (entrées VALIDES)

Batterie complète (harnais corrigé, ID réellement capturés) — identique DEV et PROD :

| Test | HTTP | DEV | PROD |
|---|---|---|---|
| getAllCharges | 200 | `success:true` (35 charges) | `success:true` |
| getDossiers | 200 | `success:true` (21 dossiers) | `success:true` |
| getChargesByDossier (OUVERT) | 200 | `success:true` | `success:true` |
| createCharge GENERALE | 200 | `success:true`, row créée | `success:true` |
| createCharge DOSSIER OUVERT | 200 | `success:true`, row créée | `success:true` |
| createCharge DOSSIER CLOTURÉ | 200 | `success:false` « le dossier doit être ouvert » | idem |
| updateCharge CLOTURÉ | 200 | `success:false` « le dossier n'est plus ouvert » | idem |
| deleteCharge CLOTURÉ | 200 | `success:false` « le dossier n'est plus ouvert » | idem |
| **deleteCharge (ID valide)** | 200 | **`success:true`, row supprimée en DB** | **`success:true`, row supprimée en DB** |
| deleteCharge ID inexistant | 200 | `success:false` « Charge non trouvée » | idem |

Preuves de persistance DB : `caf101d8-…` (PROD), `3da8bd26-…` / `1e996937-…` / `46ec83e5-…` (DEV) → **ABSENTS** après `deleteCharge` ; `x-action-revalidated` présent (revalidatePath effectif).

## Résultat (entrée INVALIDE) — LE SEUL VRAI PROBLÈME

Avec un ID non-UUID, `deleteChargeSchema.parse` lève un `ZodError` (comportement **attendu** du code). Le bug n'est pas la validation mais son traitement :

- **DEV** : `console.error("Error deleting charge:", zodError)` → crash Node :
  `TypeError: Cannot read properties of undefined (reading 'value')` à `formatProperty (node:internal/util/inspect:2279:12)` ; réponse client `1:E{digest:4062573259}` (HTTP 500 dans le log serveur).
- **PROD** : idem, `1:E{digest:1693905640}` (message minimal), crash dans `chunks/655.js:1:9557` (le `console.error` du catch de deleteCharge, code minifié identique à la source).
- **Reproduit hors Next** (Node v24.11.1 seul) :
  ```js
  try { schema.parse({ id: 'garbage…' }) } catch (e) { console.error('x', e); }
  // → TypeError: Cannot read properties of undefined (reading 'value')
  //   at formatProperty (node:internal/util/inspect:2279:12)
  ```
- **Avec `console.error` assaini**, la même action invalide renvoie proprement `{success:false, error:"Erreur lors de la suppression de la charge"}` et le log révèle le `ZodError` (preuve que la cause de l'échec était bien le crash du formateur, pas l'action).

**Portée** : ce crash affecte les 3 `catch` de `charges.ts` (create/update/delete) qui loguent une erreur Zod via `console.error`, donc toute entrée invalide sur ces actions → réponse erreur 500/flight `1:E` au lieu de `{success:false}`. Avec des entrées valides, aucun impact.

## Conclusion et score de confiance

- Les Server Actions `/dashboard/charges` sont **fonctionnelles en DEV et en PROD** (comportement identique hors wrapper flight et format d'erreur PROD).
- Le « bug deleteCharge » antérieur était un **faux positif** : ID pollué par le harnais PowerShell → ZodError légitime → **bug réel Node v24.11.1 (inspect/console.error + ZodError)** masquant tout. Aucun défaut de la logique métier ni de Prisma n'a été trouvé.
- Correctif latent à signaler au projet (non appliqué, conformément à la consigne) : `console.error` sur un ZodError crash sous Node 24 → remplacer par un log sûr (`console.error("…", error.message)` / `error instanceof Error ? error.message : error`) dans les catchs des actions.

**Score de confiance : 9/10** (scénarios reproduits par HTTP en DEV et PROD, persistance DB vérifiée, crash isolé en Node pur ; seule incertitude mineure : l'historique exact d'une charge test `d83ed3f2-…` dans une session antérieure non consignée).
