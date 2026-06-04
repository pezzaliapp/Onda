# ONDA 📻 — Radio del mondo

**L'app che ti collega alle radio del mondo.**

ONDA è una PWA (app installabile) che permette di ascoltare radio in streaming da iPhone, Android e desktop. È una **directory indipendente**: non ospita, non registra e non ritrasmette audio — si limita a collegarsi a flussi radio pubblicamente disponibili (ricerca tramite il servizio pubblico *Radio Browser* + alcune radio demo affidabili).

Niente backend, niente login, niente pubblicità, niente tracciamento.

---

## Funzioni

- **Splash** d'ingresso con logo, onde concentriche animate e pulsante "Tocca per entrare".
- **Home** con radio in evidenza e "Continua ad ascoltare".
- **Cerca**: per nome, filtro per **nazione**, filtro rapido per **genere** (tag).
- **Preferiti** e **Recenti**, salvati sul dispositivo (localStorage, con fallback in memoria).
- **Player** HTML5 con barra fissa, play/pausa, volume, equalizzatore animato.
- **Sleep timer** (15/30/45/60 min).
- **Controlli da lock screen / cuffie** (Media Session API).
- **HLS** supportato (radio in `.m3u8`, via hls.js).
- **Pulsante "segnala / richiedi rimozione"** su ogni radio (apre una mail precompilata).
- Sezioni **Info legale**, **Privacy**, **Termini**.
- Funziona **offline** per l'interfaccia (service worker); gli stream richiedono rete.

---

## Struttura dei file

```
/
├── index.html              # shell dell'app (splash, viste, player, tab bar)
├── manifest.json           # PWA: id univoco, start_url e scope espliciti
├── service-worker.js       # cache shell, network-first per HTML
├── README.md
├── css/
│   └── styles.css          # tema beige ONDA, mobile-first
├── js/
│   └── app.js              # logica: player, HLS, ricerca, preferiti, recenti, timer
└── icons/
    ├── favicon.png
    ├── apple-touch-icon.png
    ├── icon-192.png
    ├── icon-512.png
    └── icon-512-maskable.png
```

---

## Configurazione (1 minuto)

Apri `js/app.js` e, in cima, nella sezione `CONFIG`:

- **`contactEmail`**: metti la tua email reale (usata dal pulsante "segnala/rimozione" e dai Termini).
- `demo`: l'elenco di radio in evidenza/fallback (puoi aggiungerne o toglierne).

In `manifest.json`, i campi `id`, `start_url` e `scope` sono impostati su `/Onda/`.
**Se pubblichi la app in un percorso diverso** (es. repo con altro nome), aggiorna quei tre campi
con il percorso corretto (es. `/onda-radio/`). L'`id` esplicito serve a evitare che iOS confonda
ONDA con altre PWA installate dallo stesso dominio.

---

## Provare in locale

Gli stream HTTP partono solo se la pagina **non** è servita in HTTPS. In locale ci sono due modi:

1. **Doppio clic su `index.html`** → si apre come `file://`. Funziona quasi tutto; il service
   worker e alcune funzioni PWA non si attivano (è normale in `file://`).
2. **Con un piccolo server locale** (consigliato), così testi la PWA come online:
   ```bash
   # dalla cartella del progetto
   python3 -m http.server 8080
   # poi apri http://localhost:8080
   ```

> Nota: la **ricerca** (Radio Browser) e gli stream **HTTPS** funzionano in entrambi i casi.
> Gli stream **HTTP** funzionano in locale ma verranno bloccati una volta online in HTTPS
> (vedi "Limiti noti").

---

## Pubblicare su GitHub Pages

1. Crea/usa un repository **pubblico** (es. `Onda`).
2. Carica nella **radice** del repo tutto il contenuto di questa cartella
   (`index.html`, `manifest.json`, `service-worker.js`, `css/`, `js/`, `icons/`, `README.md`).
3. Vai su **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**,
   Branch `main`, cartella `/ (root)` → **Save**.
4. Dopo 1–2 minuti l'app sarà online (es. `https://<utente_o_org>.github.io/Onda/`).
5. **Importante:** se l'indirizzo finale non è `/Onda/`, aggiorna `id`/`start_url`/`scope`
   in `manifest.json` con il percorso giusto.

### Installare sul telefono
- **iPhone (Safari):** apri il link → Condividi → "Aggiungi a Home".
- **Android (Chrome):** apri il link → menu ⋮ → "Installa app".

### Aggiornamenti
Il service worker mette in cache l'interfaccia. A ogni rilascio, aumenta il numero di versione
in `service-worker.js` (`const CACHE = 'onda-vX'`) per forzare l'aggiornamento sui dispositivi.

---

## Limiti noti (onesti)

- **Stream HTTP su sito HTTPS:** i browser bloccano gli stream `http://` quando la pagina è
  servita in `https://` (mixed content). Molte radio italiane commerciali trasmettono solo in
  HTTP: online non partiranno. La ricerca, su HTTPS, **filtra automaticamente i soli stream
  HTTPS** così vedi solo radio riproducibili. Le radio segnate `HTTP` non sono riproducibili online.
- **Pubblicità delle emittenti:** alcune radio (specie commerciali) inseriscono spot all'avvio
  dello stream. È un comportamento dell'emittente, non dell'app.
- **HLS:** le radio `.m3u8` richiedono hls.js (incluso) e che il server della radio consenta il
  CORS; alcune potrebbero non partire fuori dal sito ufficiale.
- **Copertura ricerca:** Radio Browser è un archivio collaborativo: alcune emittenti potrebbero
  mancare o avere stream non aggiornati. Il pulsante "segnala" serve proprio a questo.
- **Più PWA stesso dominio (iOS):** se installi più web app dallo stesso dominio, iOS può
  confonderle; per questo il manifest usa un `id` univoco. Se possibile, pubblica ONDA in un
  percorso/dominio dedicato.

---

## Note legali

ONDA è una directory indipendente di collegamenti a flussi radio pubblicamente disponibili.
ONDA non ospita, non registra e non ritrasmette contenuti audio. Tutti i marchi, nomi, loghi e
contenuti appartengono ai rispettivi proprietari. Le emittenti possono richiedere aggiornamento o
rimozione dei propri collegamenti.

Ricerca stazioni tramite **radio-browser.info**. Riproduzione HLS tramite **hls.js**.

---

ONDA · di PezzaliApp
