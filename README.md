# Harbor Community Manga Sources

Een snelle, robuuste en betrouwbare manga-repository voor de [Harbor Stremio client](https://github.com/harborstremio/harbor).

Deze repository bevat geoptimaliseerde extensies voor:
1. **MangaDex** (`mangadex.plugin.js`)
2. **Atsu.moe** (`atsu.plugin.js`)
3. **Comix.to** (`comix.plugin.js`)

---

## Waarom deze repository?

De standaard Harbor-extensies liepen tegen specifieke netwerk- en engine-beperkingen aan. Deze repository lost die structureel op:

| Bron | Probleem in oude versie | Oplossing in deze repository |
| :--- | :--- | :--- |
| **MangaDex** | **HTTP 429 Rate Limiting**: MangaDex blokkeert verbindingen die >5 requests/sec maken, waardoor hoofdstukken en pagina's ontbraken. | **Request Scheduler**: Ingebouwde throttling (min. 260ms tussen requests) + 4-traps exponential backoff bij 429. Directe CDN image URLs via `/at-home/server/{id}`. |
| **Atsu.moe** | **Time-outs (8s)**: Trage Atsu endpoints zorgden voor verbroken verbindingen en incomplete metadata. | **30s Time-out + 3 Retries**: Verhoogde time-out limieten (`timeoutMs: 30000`) en exponentiële backoff bij netwerkfouten. |
| **Comix.to** | **Cloudflare Bot Protectie**: JavaScript challenges blokkeerden Harbor's interne fetcher. Bovendien blokkeert Harbor `localhost` in plugins (SSRF). | **FlareSolverr Bridge (`localtest.me:8191`)**: Gebruikt FlareSolverr om Cloudflare te omzeilen. Doordat `localtest.me` een openbare DNS-naam is die naar `127.0.0.1` wijst, omzeilt het Harbor's sandbox-blokkade op "localhost". |

---

## Installatie in Harbor

1. Open **Harbor**.
2. Navigeer naar **Manga > Set up a source > Extensions**.
3. Plak de URL van deze repository:
   ```text
   https://raw.githubusercontent.com/wesazx/harbor-atsu-source/main/repo.json
   ```
   *(Of laad de repository lokaal in tijdens development).*
4. Installeer de gewenste bronnen:
   - **MangaDex (English)**
   - **Atsu (English)**
   - **Comix.to (English)**

---

## FlareSolverr Setup (voor Comix.to)

Comix.to vereist een actieve FlareSolverr instantie om Cloudflare-challenges op te lossen.

### 1. FlareSolverr draaien via Docker
```bash
docker run -d \
  --name=flaresolverr \
  -p 8191:8191 \
  -e LOG_LEVEL=info \
  --restart unless-stopped \
  ghcr.io/flaresolverr/flaresolverr:latest
```

### 2. Verificatie
Test in je browser of terminal:
```bash
curl http://localhost:8191/
# Geeft: {"msg": "FlareSolverr is ready!", ...}
```

> [!NOTE]
> **Waarom `http://localtest.me:8191/v1`?**
> Harbor heeft een interne SSRF-check (`assertNetworkSafeUrl`) die directe aanroepen naar `http://localhost:...` of `http://127.0.0.1:...` weigert (`blocked private host`). `localtest.me` is een publiek geregistreerd domein dat automatisch door DNS naar `127.0.0.1` wordt omgezet. Hierdoor accepteert Harbor het verzoek en communiceert het vlekkeloos met je lokale FlareSolverr container!

---

## Alternatief: Suwayomi (Tachidesk) binnen Harbor

Wist je dat Harbor ook ingebouwde, eersteklas ondersteuning heeft voor **Suwayomi**?
In Harbor kun je onder **Manga > Set up a source** direct een Suwayomi server koppelen (standaard poort `4567`). Suwayomi draait op de achtergrond de complete Tachiyomi/Keiyoushi catalogus (meer dan 1.000 bronnen), inclusief ingebouwde WebView/FlareSolverr integratie.
