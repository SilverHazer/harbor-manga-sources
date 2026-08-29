# Atsu source for Harbor

This repository adds [Atsu](https://atsu.moe/) as an English-language Harbor source. It
contains only the Atsu provider; MangaDex is not used as a source or fallback.

## Features

- Atsu's English comic catalogue, including manga, manhwa, manhua, and OEL titles
- Popular browsing and title search with Harbor's 48-item pagination
- English titles, descriptions, authors, covers, status, year, and latest-chapter metadata
- Full English chapter lists with scanlation-group credit
- Direct Atsu page images in chapter order
- Genre filters
- Adult entries excluded from this source

## Install

In Harbor, open **Manga > Set up a source > Extensions**, paste this URL, and install
**Atsu (English)**:

```text
https://raw.githubusercontent.com/wesazx/harbor-atsu-source/main/repo.json
```

## Notes

- Atsu is the catalogue and page host. This is an unofficial community adapter and is not
  affiliated with Atsu.
- Atsu's website endpoints are not a versioned public API, so a future site change may
  require a plugin update.
- Chapter page URLs are resolved when a chapter opens and should not be cached permanently.
- Please respect Atsu and the credited scanlation groups when using or redistributing this
  source.
