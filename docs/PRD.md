# Sfera — Caratterizzatore Settoriale dell'Economia Italiana

> PRD sorgente del progetto. Le verifiche sul dato reale e le correzioni successive sono in
> [`DATA-RECON.md`](DATA-RECON.md). Dove il PRD e la ricognizione divergono, vince la ricognizione.

## 1. Executive Summary

Sfera è uno strumento di **caratterizzazione descrittiva** che ricostruisce la mappa strutturale di un'intera economia nazionale, partendo dall'Italia, scomponendola fino al livello di sotto-segmento (codice ATECO a 4 cifre, ~600–900 classi) e attaccando a ciascun segmento un nucleo di metriche economiche dure (dimensione, struttura, redditività, crescita, produttività, turnover, concentrazione) più due meta-metriche proprietarie — **Coverage Score** e **Confidence Score** — che dichiarano apertamente quanto la rappresentazione di ciascun settore sia completa e quanto sia osservata vs. stimata.

L'utente target della v1 è **uno solo: il fondatore stesso**, un imprenditore in fase pre-idea che cerca non un mercato dove vendere una soluzione già pronta, ma la *mappa dei problemi e delle strutture* di un'economia per capire dove esistono asimmetrie attaccabili. Il prodotto non classifica i settori al posto dell'utente (nessun "punteggio di opportunità" imposto): fornisce una rappresentazione comparabile, esplorabile tramite una **treemap decomponibile + tabella**, dove l'utente applica le proprie lenti.

**Perché ora:** ISTAT pubblica gratuitamente i conti economici d'impresa al livello ATECO 4 cifre (dataset *"Risultati economici delle imprese – Ateco 4 cifre"*, Reg. UE 2152/2019 sulle Structural Business Statistics). Questo abbatte la barriera di costo storica (AIDA/Cerved) e rende fattibile a **spesa dati zero** un prodotto che fino a poco fa avrebbe richiesto un budget dati significativo.

## 2. Problem & Opportunity

Chi cerca dove fare impresa affronta un paradosso informativo: i dati per capire *com'è fatto* un settore esistono ma sono frammentati, eterogenei e — soprattutto — mescolano fatti osservati e stime senza dichiararlo. Il rischio fatale non è scegliere il settore sbagliato per mancanza di dati; è **"essere estremamente sicuro di qualcosa che in realtà non conosci"**.

Opportunità: dato gratuito a 4 cifre; scalabilità cross-country nativa (ATECO = versione italiana di NACE); vuoto di mercato sul meta-livello (nessuno tratta l'*affidabilità della rappresentazione* come metrica di prima classe).

## 3. Personas & JTBD

**Persona primaria (v1):** "Il Fondatore in cerca di terreno" — il cliente sei tu.
**JTBD:** *"Quando esploro l'economia italiana per decidere dove applicarmi, voglio una rappresentazione strutturale comparabile di tutti i settori — e sapere di quali mi posso fidare — così posso individuare le asimmetrie attaccabili senza cadere nella falsa sicurezza."*

Personas secondarie (v2+, "porta aperta"): VC, PE/fondi value, imprenditori bootstrapped, scout/analisti di settore.

## 4. Solution Hypothesis — architettura a 4 livelli

| Livello | Cosa contiene | Natura | Chi decide |
|---|---|---|---|
| **L1 — Dati** | 8 metriche nucleo + attributi | Dato duro, deterministico | Il dato (ISTAT) |
| **L2 — Meta-dati** | Coverage Score, Confidence Score | Meta-oggettivo, deterministico | Il sistema |
| **L3 — Viste** | Lenti di ordinamento | Proiezioni | L'utente sceglie la lente |
| **L4 — Ranking** | Preset di pesi (Venture/PE/Imprenditore) | Interpretativo dichiarato | L'utente impugna i pesi |

Il tool è un **caratterizzatore**, non un oracolo. Niente Sector Profile Score composito imposto.

## 5. Value Proposition & Moat

*"La migliore rappresentazione possibile dell'economia, con l'onestà di dichiarare di quali parti ci si può fidare."*

Coverage/Confidence: ogni campo ha tre stati — **Osservato = 1**, **Stimato = 0,5**, **Assente = 0**. Pesi: Dimensione 20, Redditività 20, Struttura 15, Crescita 15, Produttività 10, Turnover 10, Concentrazione 5, Qualità dato 5 (totale 100). **Coverage** = % di peso su campi non assenti. **Confidence** = qualità effettiva (osservato pesa il doppio dello stimato) sui campi disponibili.

Moat: l'architettura Dati/Meta/Viste/Ranking; i meta-punteggi proprietari; il compounding cross-country via NACE.

## 6–7. Mercato & Metriche

v1 = 1 utente (il fondatore). Sizing di mercato secondario per dichiarazione dell'utente.

**North Star:** % dell'economia rappresentata con Confidence "alto" (quota di settori 4 cifre, pesata per dimensione economica, sopra soglia).

## 8. Technical Architecture

Dati ISTAT statici (rilascio ~annuale) + dataset minuscolo → architettura **local-first / static**, non cloud.

```
[Script Python] → scarica ISTAT SBS (4 cifre), normalizza ATECO, calcola Coverage/Confidence
      ↓
[sectors.json]
      ↓
[Sito statico Vite+React] treemap decomponibile + tabella + Viste (colore = Confidence)
      ↓
[GitHub Pages]
```

Truth layer 100% deterministico, **nessun LLM**. Un solo repo. Cross-country = sostituire la fonte mantenendo telaio e logica score.

## 9. Rischi principali

1. Concentrazione (HHI) non gratis a 4 cifre → peso basso, esplicito via Confidence.
2. Turnover (demografia d'impresa) solo a 3 cifre → fallback flaggato.
3. Segreto statistico spegne celle nelle classi piccole → reso visibile da Coverage/Confidence (rischio → feature).
4. Sezioni escluse (K finanza, O PA, div. 94) → dichiarate.
5. **Falsa sicurezza** (rischio esistenziale) → stato a 3 livelli + Confidence sempre visibile.
6. Over-engineering / time-to-data → scope minimo: 1 repo, 1 pipeline, 1 file, 1 UI.
7. Tentazione del punteggio composito → vietato in v1.

## 10. MVP Scope (v1) — "la cosa più piccola che ti risponde"

L1 + L2 + L3: pipeline locale, artefatto unico, treemap+tabella, 8 campi con stato a 3 livelli, Viste-lente, GitHub Pages. **Spesa dati/cloud/LLM: zero.**

Fuori scope v1: L4 ranking, modulo bilanci/concentrazione, multi-paese, auth/backend.

**Decisioni di scope adottate:** Turnover → fallback 3 cifre flaggato. Colore treemap → Confidence fisso (commutabile a Coverage).

## 11. Go-to-Market

v1: nessun GTM (strumento personale). Porta aperta v2+: wedge cross-country via NACE; tier freemium (L1–L3 gratis / L4 + concentrazione a pagamento). Vincolo: la ridistribuzione di dati da bilanci a pagamento ha restrizioni; i dati ISTAT sono ridistribuibili con attribuzione.

## 12. Raccomandazione finale

Resistere a tre tentazioni: (a) il punteggio composito che reintroduce bias; (b) l'over-engineering da azienda 5–10 persone per un prodotto a 1 utente; (c) ritardare il contatto col dato reale. **La forza di Sfera non è sapere tutto di tutto — è dichiarare onestamente quanto sa.**
