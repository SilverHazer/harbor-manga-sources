# Harbor Manga Sources 📚

Een geoptimaliseerde, stabiele en snelle manga-repository voor de [Harbor Stremio Desktop Client](https://github.com/harborstremio/harbor).

Deze repository breidt Harbor uit met betrouwbare providers voor de populairste manga-platformen, met ingebouwde bescherming tegen netwerk-timeouts, rate-limits en Cloudflare bot-beveiliging.

---

## 🚀 Snelle Installatie in Harbor

1. Start de **Harbor** app.
2. Ga in het linker menu naar **Manga** > klik op **Set up a source** (of het tandwiel/bronnen-icoon) > **Extensions**.
3. Voer in het veld **Repository URL** de volgende link in en klik op **Add Repository**:
   ```text
   https://raw.githubusercontent.com/SilverHazer/harbor-manga-sources/main/repo.json
   ```
4. Je ziet nu de beschikbare extensies in de lijst verschijnen:
   - **MangaDex (English)** (`mangadex-en` v1.0.0)
   - **Atsu (English)** (`atsu-en` v1.1.0)
   - **Comix.to (English)** (`comix-en` v1.0.0)
5. Klik op **Install** naast de gewenste extensies en selecteer je favoriete bron als actieve provider!

---

## 📖 Complete Walkthrough & Architectuur

Harbor voert manga-extensies uit in een geïsoleerde JavaScript runtime sandbox. Om maximale stabiliteit en snelheid te garanderen zonder ontbrekende pagina's of crashes, gebruikt elke bron in deze repository een gespecialiseerde architectuur:

### 1. MangaDex Provider (`mangadex.plugin.js`)
* **API**: MangaDex REST API v5 (`https://api.mangadex.org`).
* **Het Probleem**: MangaDex handhaaft een strikte limiet van circa 5 requests per seconde per IP. Wanneer Harbor snel manga-posters, hoofdstuklijsten of paginabronnen opvraagt, resulteerde dit standaard in `HTTP 429 Too Many Requests`, waardoor hoofdstukken leeg bleven of pagina's ontbraken.
* **Onze Oplossing**:
  - **Request Pacing**: Alle uitgaande API-calls worden via een interne wachtrij geleid met een minimale vertraging van 260ms tussen opeenvolgende verzoeken.
  - **Exponentiële Backoff**: Mocht er toch een netwerkfout of 429 optreden, voert de plugin automatisch tot 4 retries uit met toenemende vertraging (`attempt * 1000ms`).
  - **Filteren van externe licentielinks**: MangaDex bevat vaak hoofdstukken die gehost worden op externe platforms (zoals MangaPlus of Webnovel) zonder afbeeldingen op MangaDex zelf (`pages: 0`). Deze worden nu automatisch uitgefilterd via `includeExternalUrl=0` zodat je uitsluitend direct leesbare hoofdstukken te zien krijgt.
  - **Directe CDN Image Resolving**: Pagina-afbeeldingen worden rechtstreeks opgelost via het officiële `/at-home/server/{chapterId}` endpoint naar snelle MangaDex CDN-nodes.

### 2. Atsu.moe Provider (`atsu.plugin.js`)
* **API**: Atsu.moe GraphQL / REST endpoints (`https://atsu.moe/api/v1`).
* **Het Probleem**: De originele implementatie hanteerde een strakke timeout van slechts 8.000 milliseconden (8 seconden). Atsu.moe heeft tijdens piekuren regelmatig pieken in responstijd, wat leidde tot abrupte `FetchError` timeouts en afgebroken downloads.
* **Onze Oplossing**:
  - **Verhoogde Timeout Limiet**: De netwerk-timeout is verhoogd naar 30.000ms (30 seconden) via `AbortController`.
  - **3-traps Retry Systeem**: Bij een verbroken verbinding of server-timeout probeert de plugin het verzoek automatisch tot 3 keer opnieuw met een exponentiële backoff.
  - **Beveiligde Concurrency**: Voorkomt overbelasting van de sessie bij het ophalen van grote hoeveelheden paginabronnen tegelijk.

### 3. Comix.to Provider (`comix.plugin.js`)
* **Platform**: Comix.to (`https://comix.to`).
* **Het Probleem**: Comix.to bevindt zich achter Cloudflare bot-bescherming (JavaScript challenges en Turnstile). Een standaard HTTP-fetch vanuit Harbor stuit direct op een `HTTP 403 Forbidden` challenge-pagina. Daarnaast heeft Harbor een strenge **SSRF security filter** (`assertNetworkSafeUrl`) die verzoeken naar `localhost` of `127.0.0.1` blokkeert.
* **Onze Oplossing**:
  - **FlareSolverr Proxy Bridge**: De plugin communiceert met een lokale FlareSolverr-instantie om de Cloudflare challenge op te lossen en de echte HTML van Comix.to op te halen.
  - **De `localtest.me` SSRF Bypass**: Harbor weigert requests naar `http://localhost:8191` met de melding `blocked private host`. Om dit op te lossen maakt de plugin verbinding via `http://localtest.me:8191/v1`. Omdat `localtest.me` een publiek geregistreerde domeinnaam is die via publieke DNS altijd verwijst naar `127.0.0.1`, accepteert Harbor de URL en bereikt het veilig je lokale FlareSolverr!
  - **Multi-Anchor DOM Parser**: Omdat Comix.to de titel en de omslagafbeelding over meerdere gescheiden `<a>` elementen verdeelt, bevat de parser een geavanceerde normalisatie die posters en titels koppelt op basis van unieke URL-slugs.

---

## 🛡️ FlareSolverr Setup (Vereist voor Comix.to)

Comix.to heeft FlareSolverr nodig om Cloudflare te passeren. Atsu en MangaDex werken direct zonder extra hulpprogramma's.

### Optie A: Via Docker (Aanbevolen)
Draai FlareSolverr eenvoudig op de achtergrond via Docker:
```bash
docker run -d \
  --name=flaresolverr \
  -p 8191:8191 \
  -e LOG_LEVEL=info \
  --restart unless-stopped \
  ghcr.io/flaresolverr/flaresolverr:latest
```

### Optie B: Zonder Docker (Windows Standalone Binary)
1. Download de nieuwste release van [FlareSolverr GitHub Releases](https://github.com/FlareSolverr/FlareSolverr/releases) (`flaresolverr_windows_x64.zip`).
2. Pak het zip-bestand uit in een map naar keuze (bijv. `C:\FlareSolverr`).
3. Start `flaresolverr.exe`. Het programma luistert standaard op poort `8191`.

### Verifiëren
Open je browser of voer in PowerShell/terminal het volgende commando uit:
```bash
curl http://localhost:8191/
```
Als je het volgende antwoord ziet, is FlareSolverr klaar voor gebruik:
```json
{"msg": "FlareSolverr is ready!", "version": "v3.3.21"}
```

---

## 🔄 Aanpassingen t.o.v. de Originele Repository

Deze repository is een fork van [`wesazx/harbor-atsu-source`](https://github.com/wesazx/harbor-atsu-source). Hieronder vind je een overzicht van de doorgevoerde verbeteringen en toevoegingen:

| Onderdeel | Origineel (`wesazx/harbor-atsu-source`) | Onze Fork (`SilverHazer/harbor-manga-sources`) |
| :--- | :--- | :--- |
| **MangaDex Provider** | Oorspronkelijk verwijderd wegens instabiliteit en rate-limit fouten (`f2a6109`). | **Volledig herbouwd en geoptimaliseerd**: Voorzien van een 260ms request-queue, 4-traps exponential backoff bij 429-errors, filteren van unhosted externe hoofdstukken, en caching van API responses. |
| **Atsu.moe Provider** | Vaste timeout van 8000ms, geen automatische retries bij netwerkfouten. | **Versterkte netwerk-laag**: Timeout verhoogd naar 30.000ms, automatische 3-traps retry met exponentiële backoff bij server-drops. |
| **Comix.to Provider** | Niet aanwezig. | **Nieuwe bron toegevoegd**: Volledige catalogus en hoofdstukscraper met FlareSolverr Cloudflare-bypass en `localtest.me` SSRF-oplossing. |
| **Repository Manifest (`repo.json`)** | Bevat uitsluitend `atsu-en`. | Bevat alle 3 bronnen (`mangadex-en`, `atsu-en`, `comix-en`) met geactualiseerde versienummers en metadata. |
| **Validatie & Tooling** | Geen geautomatiseerde testscripts aanwezig. | Toegevoegd testframework (`npm test`) om netwerk- en paginabronnen direct buiten Harbor te kunnen testen en monitoren. |
| **Documentatie** | Beknopte instructies voor alleen Atsu. | Uitgebreide Nederlandse handleiding, installatie-walkthrough, architectuurdetails en FlareSolverr setupgids. |

---

## 💡 Alternatief / Back-up: Suwayomi (Tachidesk) binnen Harbor

Wist je dat Harbor ook ingebouwde ondersteuning biedt voor **Suwayomi**?
- **Waar vind je dit?** In Harbor onder **Manga** > **Set up a source** vind je een directe optie om een Suwayomi Server te koppelen (standaard host: `http://localhost:4567`).
- **Wat is het voordeel?** Suwayomi fungeert als een lokale server die het volledige Tachiyomi/Keiyoushi ecosysteem (meer dan 1.000 extensies wereldwijd) kan hosten.
- Mocht een directe Harbor JavaScript-plugin ooit tijdelijk offline zijn door website-veranderingen, dan biedt Suwayomi een onbeperkte back-up catalogus binnen dezelfde vertrouwde Harbor interface.

---

## 🧪 Lokaal Ontwikkelen & Testen

Wil je zelf wijzigingen aanbrengen of een bron testen?

1. Kloon deze repository:
   ```bash
   git clone https://github.com/SilverHazer/harbor-manga-sources.git
   cd harbor-manga-sources
   ```
2. Installeer dependencies (optioneel, voor tests):
   ```bash
   npm test
   ```
3. Valideer de syntax van alle JavaScript plugins:
   ```bash
   node --check mangadex.plugin.js
   node --check atsu.plugin.js
   node --check comix.plugin.js
   ```

---

## 🙏 Credits & Dankwoord

Dit project is geïnspireerd door en gebouwd op het fundament van:
- **[wesazx](https://github.com/wesazx)** voor de originele [`harbor-atsu-source`](https://github.com/wesazx/harbor-atsu-source) repository. Hartelijk dank voor het pionierswerk en de inspiratie om Harbor te voorzien van externe community manga-bronnen!
- **[Harbor Stremio](https://github.com/harborstremio/harbor)** voor het bouwen van een fantastische, moderne desktop-client voor anime, films, series en manga.
- De open-source teams achter **[FlareSolverr](https://github.com/FlareSolverr/FlareSolverr)** en **[MangaDex](https://mangadex.org)** voor hun robuuste publieke API's en tools.

---

## 📄 Disclaimer & Licentie

Deze extensies zijn uitsluitend bedoeld voor educatieve doeleinden en persoonlijk gebruik binnen de Harbor Stremio client. De ontwikkelaars hosten zelf geen media of auteursrechtelijk beschermd materiaal; alle content wordt rechtstreeks on-the-fly opgehaald via de respectievelijke publieke webbronnen en API's.
