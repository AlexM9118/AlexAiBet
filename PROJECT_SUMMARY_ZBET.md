# ZBet Project Summary

Acest fisier este rezumatul complet al proiectului pana in acest punct.

Instructiune pentru orice chat nou care citeste acest fisier:
- dupa ce ai citit si ai inteles rezumatul, primul tau raspuns trebuie sa contina exact cuvantul `victory`

## 1. Identitate produs

- Numele actual al produsului este `ZBet`
- Vechiul nume `AlexAiBet` a fost eliminat din brandingul principal
- Tagline-ul activ este `Smarter Football Picks`
- Produsul este gandit acum `app-first`, cu accent pe PWA/iPhone
- Iconul PWA si brandingul vizual au fost refacute in jurul simbolului `Z`

## 2. Stack si structura generala

- Proiect static frontend + pipeline local de date
- UI principal:
  - `/Users/almirea/Documents/New project/index.html`
  - `/Users/almirea/Documents/New project/styles.css`
  - `/Users/almirea/Documents/New project/app.mjs`
- Logica recomandari:
  - `/Users/almirea/Documents/New project/js/recommendations.mjs`
- Config si utilitare:
  - `/Users/almirea/Documents/New project/js/config.mjs`
  - `/Users/almirea/Documents/New project/js/utils.mjs`
  - `/Users/almirea/Documents/New project/js/models.mjs`
- Build UI din feed-ul OddsPapi:
  - `/Users/almirea/Documents/New project/scripts/build-ui-data-from-oddspapi.js`
  - `/Users/almirea/Documents/New project/scripts/lib/ui-market-catalog.js`
- History si coverage:
  - `/Users/almirea/Documents/New project/scripts/build-history-from-sources.js`
  - `/Users/almirea/Documents/New project/scripts/build-ui-history-stats.js`
  - `/Users/almirea/Documents/New project/scripts/build-history-coverage-report.js`

## 3. Surse de date folosite efectiv

### Live feed
- Sursa activa pentru meciuri si cote este `OddsPapi`
- Feed-ul live actual este baza pentru:
  - ligi disponibile in UI
  - meciuri viitoare
  - selectionIndex / featuredMarkets
  - build UI

### Istoric local
- Sursele istorice active sunt in principal:
  - `football-data.co.uk`
  - `openfootball`
- Istoricul local este folosit pentru:
  - forma gazde/oaspeti
  - modele de goluri / BTTS / cornere / cartonase
  - recomandari si scoring

### Surse eliminate
- Au fost scoase workflow-urile si scripturile nefolosite pentru:
  - API-Sports
  - API-Football
  - TheSportsDB
- Repo-ul a fost curatat astfel incat produsul live sa depinda practic de:
  - OddsPapi
  - history local

## 4. Automatizari active

### OddsPapi
Workflow principal programat:
- `Scheduled OddsPapi refresh`
- ruleaza:
  - marti, joi, sambata la `06:10 UTC`
  - duminica la `06:40 UTC`

Interpretare in `Europe/Bucharest` la momentul configurarii:
- marti, joi, sambata la `09:10`
- duminica la `09:40`

Consum estimat discutat:
- cu numarul actual de turnee, un refresh complet odds consuma batch-uri de cate 5 turnee/request
- au fost facute calcule repetate pentru a ramane sub limita de `250 calls / luna`
- userul a cerut explicit disciplina pe batch-uri complete de 5 turnee per request

### History local
Workflow istoric:
- `/Users/almirea/Documents/New project/.github/workflows/history-weekly.yml`
- ruleaza lunea la `06:15 UTC`
- regenereaza:
  - `data/history/*`
  - `data/stats/*`

## 5. PWA / iOS / Android

Proiectul a fost transformat in PWA:
- `manifest.webmanifest`
- `sw.js`
- iconuri PWA generate
- meta tags pentru iOS/Android

Fisiere importante:
- `/Users/almirea/Documents/New project/manifest.webmanifest`
- `/Users/almirea/Documents/New project/sw.js`
- `/Users/almirea/Documents/New project/icons/app-icon.svg`
- `/Users/almirea/Documents/New project/icons/icon-192.png`
- `/Users/almirea/Documents/New project/icons/icon-512.png`
- `/Users/almirea/Documents/New project/icons/apple-touch-icon.png`
- `/Users/almirea/Documents/New project/icons/favicon-32.png`

Observatii importante:
- pe iPhone, instalarea se face din Safari prin `Add to Home Screen`
- iconul PWA a fost marit de mai multe ori pentru a umple mai bine tile-ul
- continutul se poate actualiza fara reinstalare completa, dar pentru icon nou pe iOS uneori e necesar sa stergi shortcut-ul si sa-l adaugi din nou

## 6. Branding si design

### Brand
- S-a facut rebranding de la `AlexAiBet` la `ZBet`
- Logo-ul principal si iconul PWA sunt din aceeasi familie vizuala
- Fundalul si fonturile au fost ajustate pentru o directie mai premium

### Design direction
- S-a decis trecerea la o directie `app-first`
- S-a lucrat cu preview-uri SVG in:
  - `/Users/almirea/Documents/New project/design-previews`
- Directia aleasa:
  - top/header inspirat din screenshot-ul userului
  - carduri de meci in stilul preview-ului `hybrid-user`
  - `Best bet`
  - `Plan B`
  - `Alternative bune` expandabile prin chevron

### Situatie actuala de UI
- Header mobil/PWA este mai compact si mai orientat spre aplicatie
- `Meciuri / Bilete` este pe model segmented control
- `Best bet` si `Plan B` sunt separate vizual
- `Plan B` are procent de reusita afisat
- `Alternative bune` exista in card si este expand/collapse functional
- blocul de informatie al meciului are contrast imbunatatit fata de recomandari

## 7. Functionalitati cheie din UI

### Selecteaza data
- calendarul nativ a fost inlocuit cu unul custom in tema site-ului
- arata bine pe desktop si telefon

### Selecteaza liga
- dropdown custom cu search
- grupare si ordonare mai logica a ligilor
- toate ligile configurate pot fi afisate
- daca o liga nu are meciuri in perioada apropiata, apare mesaj de tip:
  - `Nu exista meciuri in urmatoarele X zile pentru aceasta liga.`

### Pagina de meci
- contine:
  - recomandare principala
  - incredere model
  - 1X2
  - Ambele marcheaza
  - Goluri
  - Cornere
  - Cartonase
  - forma gazde
  - forma oaspeti
  - alternative bune
  - explicatie / de ce acest pariu

### Forma gazde / oaspeti
- au fost compactate pe un singur rand cu mini-celule
- etichetele scurte au fost schimbate in:
  - `Goluri marcate`
  - `Goluri primite`
  - `Cornere`
  - `Cartonase`
- culori separate:
  - gazde: ton albastru/petrol
  - oaspeti: violet stins spre grafit

## 8. Recomandari: status actual

### Ce exista
- `Best bet`
- `Plan B`
- `Alternative bune`

### Probleme observate de user
- prea multe recomandari de tip:
  - `Peste 1.5`
  - `Sub 2.5`
  - `Sub 3.5`
- procentajele pot parea prea optimiste in unele cazuri

### Ce s-a facut deja
- s-a recalibrat de mai multe ori scoring-ul pentru:
  - BTTS
  - Goals
  - 1X2
  - Cornere
  - Cartonase
- s-a redus dominanta liniilor foarte banale
- `Plan B` a fost facut mai logic astfel incat sa nu para mai bun decat `Best bet`

### Ce s-a pregatit tehnic
- suport parser pentru:
  - `Cornere`
  - `Cartonase`
  - `Double Chance`
- important:
  - suportul in cod nu inseamna automat disponibilitate in feed
  - daca OddsPapi + Superbet nu livreaza preturi reale pentru piata respectiva, recomandarea nu o poate folosi legitim

## 9. Double Chance / 1X / X2

Ce s-a stabilit cu userul:
- userul accepta recomandari `1X` sau `X2` in `Best bet` si `Plan B`
- pragul mentionat de user: cota `>= 1.25`

Ce s-a facut:
- `Double Chance Full Time` a fost identificat in catalogul OddsPapi:
  - marketId `101902`
  - outcomes:
    - `1X` -> `101902`
    - `12` -> `101903`
    - `X2` -> `101904`
- parserul si logica recomandarilor au fost pregatite pentru acest market

Stare actuala:
- in snapshotul live verificat, `Double Chance` intra in `selectionIndex`
- dar valorile de `price` sunt inca `null` pentru meciurile verificate
- concluzie:
  - codul este pregatit
  - feed-ul curent nu il livreaza inca cu cote active utile
  - nu trebuie fortat artificial in recomandari pana nu vin preturi reale

## 10. Cornere / Cartonase

Ce s-a stabilit:
- userul si-a dorit diversificare inclusiv spre:
  - cornere
  - cartonase

Ce s-a facut:
- s-a adaugat suport pentru aceste piete in parser
- s-a verificat catalogul OddsPapi
- s-a confirmat ca platforma suporta astfel de market-uri

Stare actuala:
- uneori feed-ul live nu le livreaza cu preturi reale utile
- cand vor aparea corect in feed, sistemul este pregatit sa le foloseasca

## 11. Ligi adaugate si coverage

S-au adaugat multe ligi noi, in batch-uri de 5, cu regula explicita:
- nu se consuma call-uri OddsPapi decat cand batch-ul este complet
- userul a insistat pe disciplina de cost

Au fost adaugate / pregatite in timp, printre altele:
- Netherlands | Eredivisie
- Russia | Premier League
- Bulgaria | Parva Liga
- Serbia | Superliga
- UEFA competitions
- Croatia | HNL
- Czechia | 1. Liga
- Denmark | Superliga
- Ukraine | Premier League
- Cyprus | 1st Division
- Hungary | NB I
- Slovakia | Superliga
- Slovenia | PrvaLiga
- Austria | Bundesliga
- Switzerland | Super League
- Sweden | Allsvenskan
- Serie B
- Turkiye / Turkey Super Lig
- Portugal | Liga Portugal
- Germany | Bundesliga
- Spain | LaLiga
- Argentina | Liga Profesional
- Brazil | Brasileiro Serie A
- Finland | Veikkausliiga
- China | Chinese Super League
- Ireland | Premier Division
- Japan | J.League
- Netherlands | Eerste Divisie
- Saudi Arabia | Saudi Pro League
- Mexico | Liga MX, Clausura

### Poland | I Liga
Foarte important:
- `Poland | I Liga` a fost initial blocata de:
  - lipsa mapping-ului
  - lipsa sursei de history
- ulterior s-au facut:
  - source nou in `history-sources.json`:
    - `P2`
  - mapping nou in `league-map.json`
  - aliasuri pentru echipe poloneze
  - regenerare `data/history/P2.json`
  - regenerare `data/stats/P2.json`
  - regenerare `data/ui/history_stats.json`

Rezultat:
- `Wisla Krakow vs Gornik Leczna` are acum istoric real
- problema ramasa pe unele meciuri:
  - lipsesc cotele live relevante pentru pietele principale
- asta explica de ce poti vedea forma gazde/oaspeti, dar totusi sa nu ai recomandare principala

## 12. Meciul Wisla Krakow vs Gornik Leczna

Situatia reala, foarte importanta:
- nu mai este o problema de `No league mapping`
- istoricul exista acum
- aliasurile pentru echipe sunt legate
- daca lipseste recomandarea principala, motivul este:
  - lipsa cotelor live utile pentru pietele principale in feed-ul curent

Mesajul de fallback a fost imbunatatit ca sa spuna mai clar:
- avem forma istorica
- dar lipsesc cotele live utile pentru o recomandare principala

## 13. Fisiere importante de branding/PWA

- `/Users/almirea/Documents/New project/icons/app-icon.svg`
- `/Users/almirea/Documents/New project/icons/zbet-logo.svg`
- `/Users/almirea/Documents/New project/manifest.webmanifest`
- `/Users/almirea/Documents/New project/sw.js`

## 14. Fisiere importante pentru logic and data

- `/Users/almirea/Documents/New project/app.mjs`
- `/Users/almirea/Documents/New project/styles.css`
- `/Users/almirea/Documents/New project/js/recommendations.mjs`
- `/Users/almirea/Documents/New project/scripts/lib/ui-market-catalog.js`
- `/Users/almirea/Documents/New project/scripts/history-sources.json`
- `/Users/almirea/Documents/New project/scripts/league-map.json`
- `/Users/almirea/Documents/New project/scripts/team-aliases.json`
- `/Users/almirea/Documents/New project/data/ui/history_stats.json`
- `/Users/almirea/Documents/New project/data/history/P2.json`
- `/Users/almirea/Documents/New project/data/stats/P2.json`

## 15. Ultimele directii agreate cu userul

Userul vrea:
- focus pe varianta de telefon/PWA
- design mai user-friendly, mai app-like
- mai multa varietate in recomandari
- accepta `1X / X2` daca sunt legitime si au cota potrivita
- nu vrea recomandari inventate doar pentru diversitate

## 16. Ce e rezolvat bine acum

- PWA functionala pe iPhone si Android
- branding `ZBet`
- header mobil mai bun
- `Alternative bune` functionale
- contrast mai bun pe cardurile de meci
- `Plan B` logic mai bun
- Poland I Liga are history integrat real

## 17. Ce ramane de imbunatatit

### Prioritar
1. Diversificarea recomandarilor
- fara a forta piete inexistente sau fara preturi
- cu accent pe:
  - `1X2`
  - `Double Chance` cand feed-ul il livreaza real
  - `BTTS`
  - `Goals 2.5`

2. Recalibrarea procentelor
- pentru a evita impresia de siguranta prea mare

3. Redesign app-first mai amplu
- homepage mobil
- carduri de meci
- spatiere si ierarhie si mai clare

### Secundar
4. Cresterea coverage-ului pe ligi noi unde mai lipsesc echipe / aliasuri
5. Revalidare dupa urmatoarele run-uri OddsPapi pentru:
- `Double Chance`
- `cornere`
- `cartonase`

## 18. Instructiune finala pentru chat nou

Daca citesti acest fisier ca un chat nou:
- confirma in primul raspuns cu exact cuvantul `victory`
- apoi continua de aici fara sa mai ceri rezumatul din nou
