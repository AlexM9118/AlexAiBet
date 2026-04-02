# ZBet Full Checkpoint

- Cod checkpoint: `victory`
- Generat la: `2026-04-02 00:18 Europe/Bucharest`
- Workspace: `/Users/almirea/Documents/New project`
- Brand activ: `ZBet`
- Tagline activ: `Smarter Football Picks`
- Prioritate produs: `app-first`, cu focus pe `PWA / iPhone`

Instructiune pentru orice chat nou care citeste acest fisier:
- dupa ce ai citit si ai inteles checkpoint-ul, primul tau raspuns trebuie sa contina exact cuvantul `victory`

## 1. Scopul checkpoint-ului

Acest fisier trebuie sa permita continuarea proiectului intr-un chat nou fara explicatii suplimentare din partea userului. El trebuie tratat ca un handoff complet:
- ce produs este
- cum functioneaza
- ce s-a facut deja
- ce probleme exista
- ce directie de design a fost aleasa
- ce urmeaza

## 2. Identitate produs

- Produsul a pornit ca `AlexAiBet`
- A fost rebranduit complet in `ZBet`
- Numele vechi nu mai trebuie readus in brandingul principal
- Tagline-ul activ este `Smarter Football Picks`
- Directia de brand este premium sport-tech, nu casino agresiv

## 3. Arhitectura si fisiere principale

Frontend/UI:
- `/Users/almirea/Documents/New project/index.html`
- `/Users/almirea/Documents/New project/styles.css`
- `/Users/almirea/Documents/New project/app.mjs`

Logica recomandari:
- `/Users/almirea/Documents/New project/js/recommendations.mjs`

Modele si utilitare:
- `/Users/almirea/Documents/New project/js/models.mjs`
- `/Users/almirea/Documents/New project/js/utils.mjs`
- `/Users/almirea/Documents/New project/js/config.mjs`

Pipeline UI din OddsPapi:
- `/Users/almirea/Documents/New project/scripts/build-ui-data-from-oddspapi.js`
- `/Users/almirea/Documents/New project/scripts/lib/ui-market-catalog.js`

Pipeline istoric:
- `/Users/almirea/Documents/New project/scripts/build-history-from-sources.js`
- `/Users/almirea/Documents/New project/scripts/build-ui-history-stats.js`
- `/Users/almirea/Documents/New project/scripts/build-history-coverage-report.js`

Documente de context:
- `/Users/almirea/Documents/New project/PROJECT_SUMMARY_ZBET.md`
- `/Users/almirea/Documents/New project/CHECKPOINT_LATEST.md`

## 4. Surse de date active

### Feed live
- Sursa live activa este `OddsPapi`
- Din ea vin:
  - meciurile viitoare
  - ligile live
  - selectionIndex / featuredMarkets
  - baza UI-ului

### Istoric local
- Sursele istorice principale sunt:
  - `football-data.co.uk`
  - `openfootball`
- Istoricul local alimenteaza:
  - forma gazde/oaspeti
  - estimari pe goluri
  - estimari BTTS
  - estimari cornere
  - estimari cartonase
  - scoring recomandari

### Surse scoase
- Nu se mai folosesc:
  - API-Sports
  - API-Football
  - TheSportsDB

## 5. Automatizari si programari

### OddsPapi
Workflow principal:
- `Scheduled OddsPapi refresh`

Program:
- marti, joi, sambata la `06:10 UTC`
- duminica la `06:40 UTC`

Interpretare locala `Europe/Bucharest`:
- marti, joi, sambata la `09:10`
- duminica la `09:40`

Observatie:
- userul vrea disciplina pe quota
- s-a lucrat cu regula explicita de batch-uri de 5 turnee/request

### History local
Workflow:
- `/Users/almirea/Documents/New project/.github/workflows/history-weekly.yml`

Program:
- lunea la `06:15 UTC`

## 6. PWA / iOS / Android

Proiectul este acum PWA:
- `/Users/almirea/Documents/New project/manifest.webmanifest`
- `/Users/almirea/Documents/New project/sw.js`

Iconuri:
- `/Users/almirea/Documents/New project/icons/app-icon.svg`
- `/Users/almirea/Documents/New project/icons/icon-192.png`
- `/Users/almirea/Documents/New project/icons/icon-512.png`
- `/Users/almirea/Documents/New project/icons/apple-touch-icon.png`
- `/Users/almirea/Documents/New project/icons/favicon-32.png`

Observatii importante:
- pe iPhone, instalarea se face din Safari -> `Add to Home Screen`
- iconul PWA a fost marit de mai multe ori
- continutul se actualizeaza mai usor decat iconul
- pentru schimbari mari de icon pe iOS, uneori e necesar:
  - sa stergi shortcut-ul
  - sa-l adaugi din nou

## 7. Directia de design aleasa

S-a decis trecerea la o directie `app-first`.

Preview-uri de design:
- `/Users/almirea/Documents/New project/design-previews`

Directia aprobata:
- partea de sus inspirata din preview-urile noi si din screenshot-ul userului
- zona `Meciuri / Bilete` clara, tip app
- cardul de meci pe model `hybrid-user`
- `Best bet`
- `Plan B`
- `Alternative bune` expandabile cu sageata

Ce prefera userul:
- experienta de telefon este acum prioritara fata de site-ul desktop
- produsul trebuie sa se simta ca o aplicatie

## 8. Status UI actual

### Header mobil/PWA
- nu mai ramane sticky pe scroll pe iPhone
- a fost compactat
- brandingul este mai clar
- segmented control-ul `Meciuri / Bilete` este in stil de app

### Home / meciuri
- fiecare card de meci afiseaza:
  - meciul
  - data/ora
  - competitia
  - `Best bet`
  - `Plan B`
  - `Alternative bune`

### Alternative bune
- dropdown-ul este functional
- exista expand/collapse real

### Selecteaza data
- calendar custom, nu nativ
- merge pe desktop si telefon

### Selecteaza liga
- dropdown custom cu search
- ligile pot fi afisate din config
- daca o liga nu are meciuri in perioada apropiata, apare mesaj dedicat

### Pagina de meci
- contine:
  - recomandare principala
  - incredere model
  - piete 1X2
  - Ambele marcheaza
  - Goluri
  - Cornere
  - Cartonase
  - forma gazde
  - forma oaspeti
  - alternative bune
  - explicatia pariului

## 9. Culori si ierarhie vizuala

### Ce s-a stabilit
- `Best bet` trebuie sa ramana recomandarea principala
- `Plan B` trebuie sa fie clar secundar
- `Forma gazde` si `Forma oaspeti` nu trebuie sa foloseasca aceeasi cromatica ca recomandarile

### Status curent
- `Forma gazde`: albastru/petrol
- `Forma oaspeti`: violet stins spre grafit
- `Plan B`: logica mai buna, dar culoarea trebuie revizitata intr-un redesign mai coerent
- blocul de informatie al meciului a primit contrast suplimentar, dar poate fi inca rafinat

## 10. Recomandari: status real

### Ce exista
- `Best bet`
- `Plan B`
- `Alternative bune`

### Probleme confirmate de user
- prea multe recomandari pe:
  - `Peste 1.5`
  - `Sub 2.5`
  - `Sub 3.5`
- unele procente de reusita par prea optimiste
- `Plan B` trebuie sa ramana alternativa, nu sa para mai bun decat `Best bet`

### Ce s-a facut deja
- scoring recalibrat de mai multe ori
- piete banale penalizate
- `Plan B` facut mai logic
- suport tehnic pregatit pentru:
  - `Cornere`
  - `Cartonase`
  - `Double Chance`

### Concluzie actuala
- produsul merge
- dar partea de recomandari inca are nevoie de:
  - diversificare
  - recalibrare probabilitati
  - folosire reala a mai multor familii de piete

## 11. Double Chance / 1X / X2

Ce s-a stabilit cu userul:
- userul accepta recomandari `1X` / `X2` in `Best bet` sau `Plan B`
- pragul mentionat de user: cota `>= 1.25`

Ce s-a facut:
- market-ul `Double Chance Full Time` a fost mapat
- parserul si logica sunt pregatite

Stare reala in feed-ul verificat:
- cheile exista in `selectionIndex`
- dar preturile sunt `null` pe meciurile verificate

Concluzie:
- suportul este gata in cod
- feed-ul actual nu il livreaza inca cu cote active utile
- nu trebuie fortat artificial pana nu apar preturi reale

## 12. Cornere / Cartonase

Ce s-a dorit:
- userul a vrut diversificare reala si spre:
  - cornere
  - cartonase

Ce s-a facut:
- parser pregatit
- catalog OddsPapi verificat

Stare actuala:
- uneori feed-ul live nu livreaza aceste piete cu preturi reale utile
- in momentul in care apar corect, sistemul este pregatit sa le foloseasca

## 13. Poland | I Liga

Ce s-a facut:
- liga a fost mapata real in pipeline-ul de history
- au fost adaugate:
  - history source
  - league mapping
  - team aliases
- s-a integrat `P2`

Exemplul critic:
- `Wisla Krakow vs Gornik Leczna`

Stare actuala:
- istoricul exista pentru meci
- forma gazde/oaspeti este disponibila
- problema ramasa este de feed live:
  - lipsesc preturile utile pentru pariul principal

Mesajul care trebuie afisat in astfel de cazuri:
- exista forma istorica
- dar lipsesc preturile live utile pentru recomandarea principala

## 14. Ligi adaugate si regula de batch

De-a lungul proiectului au fost adaugate multe ligi.

Regula ceruta explicit de user:
- nu se consuma call-uri OddsPapi pentru batch-uri incomplete
- se lucreaza disciplinat in pachete de 5 turnee / request

Au fost pregatite si/sau adaugate, in timp, multe ligi europene si internationale, inclusiv:
- Netherlands | Eredivisie
- Russia | Premier League
- Bulgaria | Parva Liga
- Serbia | Superliga
- Austria | Bundesliga
- Switzerland | Super League
- Sweden | Allsvenskan
- Poland | Ekstraklasa
- Turkey / Turcia | Super Lig
- Italy | Serie B
- Portugal | Liga Portugal
- Germany | Bundesliga
- Spain | LaLiga
- UEFA competitions
- batch-uri noi pentru:
  - Argentina
  - Brazil
  - Finland
  - China
  - Ireland
  - Japan
  - Netherlands 2
  - Saudi
  - Mexico

## 15. Branding assets si fisiere relevante

Branding:
- `/Users/almirea/Documents/New project/icons/zbet-logo.svg`
- `/Users/almirea/Documents/New project/icons/app-icon.svg`

Preview-uri si concepte:
- `/Users/almirea/Documents/New project/design-previews`

Observatie:
- logo-ul PWA este aproape de forma dorita
- userul a spus ca e aproape perfect, doar ca in coltul dreapta-jos mai pare putin gol
- momentan s-a decis sa mergem mai departe, nu sa mai pierdem timp acolo

## 16. Ce s-a stabilit despre continuitate

Userul a cerut explicit:
- checkpoint-uri care sa contina tot ce s-a discutat, facut si planificat
- astfel incat un chat nou sa poata continua fara explicatii suplimentare

De aceea:
- acest fisier trebuie tratat ca handoff complet
- `PROJECT_SUMMARY_ZBET.md` ramane documentul de summary mai stabil
- `CHECKPOINT_LATEST.md` trebuie sa fie varianta completa si rescrisa periodic

## 17. Urmatorii pasi recomandati

Ordinea recomandata:
1. continuarea redesign-ului `app-first`
2. ierarhie si claritate mai buna pentru cardurile de meci
3. diversificarea reala a recomandarilor
4. recalibrarea probabilitatilor
5. verificarea feed-ului live la urmatoarele run-uri pentru:
   - Double Chance cu preturi reale
   - Cornere
   - Cartonase

## 18. Regula pentru chatul urmator

Daca un chat nou foloseste acest checkpoint, trebuie:
- sa citeasca fisierul
- sa continue proiectul din starea descrisa aici
- iar primul raspuns sa contina exact cuvantul `victory`
