# MangaDex source for Harbor

This repository adds MangaDex as an English-language Harbor source. It uses MangaDex's
public API rather than scraping web pages.

## Features

- Popular titles ordered by MangaDex follower count
- Title search with 48-item Harbor pagination
- English title, description, author, cover, status, year, rating, and last-chapter metadata
- English chapter feeds with scanlation-group credit
- Original-quality pages from MangaDex@Home over standard HTTPS ports
- MangaDex genre, theme, format, and content tag filters
- Safe and suggestive catalogue entries only; external, unavailable, empty, and future chapters are excluded

## Install

1. Put `repo.json` and `mangadex.plugin.js` side by side on a static HTTPS host.
2. In Harbor, open **Manga > Set up a source > Extensions**.
3. Paste the public HTTPS URL of `repo.json`, then install **MangaDex (English)**.

For GitHub, commit both files at the repository root and use a URL like:

```text
https://raw.githubusercontent.com/wesazx/harbor-mangadex-source/main/repo.json
```

The `entry` in `repo.json` is relative, so Harbor will load the plugin file from the same
folder as the manifest.

## MangaDex usage conditions

MangaDex is the data and page source and must be credited. Chapter results expose the
scanlation group in Harbor's `group` field. If you distribute or host this plugin, follow
the current MangaDex API acceptable-use rules, including honoring content-removal requests
from scanlation groups. Do not use MangaDex API content in an ad-supported or paid reader.

Official references:

- API documentation: https://api.mangadex.org/docs/
- API specification: https://api.mangadex.org/docs/api.yaml
- MangaDex: https://mangadex.org/

## Notes

- The source intentionally returns English chapters only.
- A title can appear in popular/search results but have no currently readable English
  chapters if its historical uploads were removed from MangaDex.
- MangaDex@Home page URLs are temporary. Harbor should request `pageUrls` when opening a
  chapter rather than caching those URLs permanently.
