# Focusul Zilei - variante de produs

Acest document propune variante de redesign pentru actuala zona `Bilete`.
Ideea este sa iesim din limbajul clasic de "bilet" si sa transformam functia
intr-o zona mai premium, mai clara si mai utila pentru utilizatorul mobil.

## Varianta 1 - Focusul zilei

Aceasta este varianta recomandata.

Structura:
- `Conservator`
- `Echilibrat`
- `Curajos`

Ce vede utilizatorul:
- un rezumat scurt pentru fiecare profil
- 3-5 selectii propuse
- cota totala estimata
- probabilitate combinata
- un mic text de context:
  - "azi sunt mai multe meciuri bune pentru goluri"
  - "mixul zilei favorizeaza piete mai prudente"

De ce se potriveste cu proiectul:
- mapare naturala peste `safe / value / boost`
- poate refolosi `buildDisplayedTickets()`
- suna mai matur decat `Bilete`
- se potriveste bine cu brandul `ZBet`

## Varianta 2 - Top selectii

Structura:
- `Top 3 azi`
- `Cele mai sigure`
- `Cele mai bune cote`

Ce vede utilizatorul:
- nu mai exista ideea de bilet complet
- exista grupuri de selectii curate
- utilizatorul isi poate construi singur combinatia

Avantaj:
- simplu
- foarte clar

Dezavantaj:
- pierde ideea de produs "gata de folosit"

## Varianta 3 - Mixurile zilei

Structura:
- `Mix prudent`
- `Mix echilibrat`
- `Mix dinamic`

Ce vede utilizatorul:
- o combinatie gata grupata
- accent pe diversitate de piete
- fiecare mix are explicatia lui

Avantaj:
- foarte bun pentru branding
- suna modern

Dezavantaj:
- putin mai abstract decat `Focusul zilei`

## Varianta 4 - Harta zilei

Structura:
- `Focus principal`
- `Alternative bune`
- `Combinatie extinsa`

Ce vede utilizatorul:
- mai mult un tab editorial
- ziua este explicata prin 3 straturi

Avantaj:
- foarte premium

Dezavantaj:
- cere mai mult text si mai multa explicatie

## Recomandarea mea

As merge pe:
- nume tab: `Focusul zilei`
- 3 profile:
  - `Conservator`
  - `Echilibrat`
  - `Curajos`

## Functionalitati aplicabile direct pe proiect

1. Refolosirea logica actuala
- `safe` -> `Conservator`
- `value` -> `Echilibrat`
- `boost` -> `Curajos`

2. Header explicativ pe zi
- un text scurt generat din distributia recomandarilor:
  - "Zi buna pentru selectie prudenta"
  - "Mai multe meciuri favorizeaza golurile"
  - "Varietate buna intre 1X2, BTTS si goluri"

3. Diversitate controlata
- sa penalizam combinatiile care repeta prea multe piete similare
- exemplu: nu vrem 4 leg-uri consecutive doar pe `Peste 1.5`

4. Explicatie pe fiecare grup
- `Conservator`: probabilitate mai buna, cota mai mica
- `Echilibrat`: raport mai bun intre cota si risc
- `Curajos`: selectie mai agresiva, dar controlata

5. Badge-uri utile
- `Mai sigur`
- `Cel mai echilibrat`
- `Mai agresiv`

6. CTA intern mai bun
- in loc de `Bilet tinta`
- folosim:
  - `Strategia zilei`
  - `Structura selectiilor`
  - `De ce acest mix`

7. Compatibilitate buna cu app-first
- fiecare profil poate fi un card mare
- cu leg-uri expandabile sub el
- foarte potrivit pentru mobil
