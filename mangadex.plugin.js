// MangaDex source for Harbor.
// Uses only Harbor's worker bridge and the public MangaDex API.

const API_BASE = "https://api.mangadex.org";
const COVER_BASE = "https://uploads.mangadex.org/covers";
const MANGA_PAGE = 48;
const CHAPTER_BATCH = 500;
const MAX_CHAPTERS = 5000;
const HEADERS = {
  accept: "application/json",
  "user-agent": "Harbor-MangaDex/1.0.0"
};

function addParam(url, name, value) {
  if (value === undefined || value === null || value === "") return;
  if (Array.isArray(value)) {
    for (const item of value) addParam(url, name, item);
    return;
  }
  url.searchParams.append(name, String(value));
}

function buildUrl(path, params) {
  const url = new URL(path, API_BASE);
  for (const pair of params || []) addParam(url, pair[0], pair[1]);
  return url.toString();
}

function apiErrorMessage(payload) {
  if (!payload || !Array.isArray(payload.errors) || !payload.errors.length) {
    return "Unknown API error";
  }
  const error = payload.errors[0] || {};
  return error.detail || error.title || "Unknown API error";
}

async function requestJson(path, params, allowNotFound) {
  const response = await harbor.http(buildUrl(path, params), {
    headers: HEADERS,
    responseType: "text",
    timeoutMs: 15000
  });

  if (allowNotFound && response && response.status === 404) return null;

  let payload = null;
  try {
    payload = response && response.body ? JSON.parse(response.body) : null;
  } catch (_error) {
    payload = null;
  }

  if (!response || !response.ok || !payload || payload.result === "error") {
    const status = response && response.status ? response.status : "network";
    const message = apiErrorMessage(payload);
    harbor.log("MangaDex request failed", path, status, message);
    throw new Error("MangaDex request failed (" + status + "): " + message);
  }

  return payload;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function delay(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
}

function firstLocalized(localized, preferredLanguage) {
  if (!localized || typeof localized !== "object") return "";
  const preferred = nonEmptyString(localized[preferredLanguage]);
  if (preferred) return preferred;
  const english = nonEmptyString(localized.en);
  if (english) return english;
  for (const key of Object.keys(localized)) {
    const value = nonEmptyString(localized[key]);
    if (value) return value;
  }
  return "";
}

function titlesFor(attributes) {
  const originalLanguage = attributes.originalLanguage || "en";
  const primaryEnglish = nonEmptyString(attributes.title && attributes.title.en);
  const primaryOriginal = firstLocalized(attributes.title, originalLanguage);
  const alternatives = [];

  for (const localized of attributes.altTitles || []) {
    const english = nonEmptyString(localized && localized.en);
    if (english) alternatives.push(english);
  }
  for (const localized of attributes.altTitles || []) {
    const value = firstLocalized(localized, originalLanguage);
    if (value) alternatives.push(value);
  }

  const title = primaryEnglish || alternatives[0] || primaryOriginal || "Untitled";
  const candidates = [primaryOriginal].concat(alternatives);
  let altTitle = "";
  for (const candidate of candidates) {
    if (candidate && candidate.toLocaleLowerCase() !== title.toLocaleLowerCase()) {
      altTitle = candidate;
      break;
    }
  }
  return { title, altTitle };
}

function relationshipNames(entity, type) {
  const names = [];
  for (const relationship of entity.relationships || []) {
    if (relationship.type !== type) continue;
    const name = nonEmptyString(relationship.attributes && relationship.attributes.name);
    if (name && names.indexOf(name) === -1) names.push(name);
  }
  return names;
}

function relationship(entity, type) {
  for (const item of entity.relationships || []) {
    if (item.type === type) return item;
  }
  return null;
}

function mangaSummary(entity) {
  const attributes = entity.attributes || {};
  const names = titlesFor(attributes);
  const summary = {
    id: String(entity.id),
    title: names.title
  };

  if (names.altTitle) summary.altTitle = names.altTitle;

  const cover = relationship(entity, "cover_art");
  const coverFile = nonEmptyString(cover && cover.attributes && cover.attributes.fileName);
  if (coverFile) {
    summary.cover = COVER_BASE + "/" + encodeURIComponent(entity.id) + "/" +
      encodeURIComponent(coverFile) + ".512.jpg";
  }

  if (Number.isInteger(attributes.year)) summary.year = attributes.year;
  if (nonEmptyString(attributes.status)) summary.status = attributes.status;

  const description = firstLocalized(attributes.description, "en");
  if (description) summary.description = description;
  if (nonEmptyString(attributes.contentRating)) {
    summary.contentRating = attributes.contentRating;
  }
  if (nonEmptyString(attributes.lastChapter)) {
    summary.lastChapter = attributes.lastChapter;
  }

  let authors = relationshipNames(entity, "author");
  if (!authors.length) authors = relationshipNames(entity, "artist");
  if (authors.length) summary.author = authors.join(", ");

  return summary;
}

function mangaListParams(offset, tagId) {
  const params = [
    ["limit", MANGA_PAGE],
    ["offset", Math.max(0, Math.floor(Number(offset) || 0))],
    ["availableTranslatedLanguage[]", "en"],
    ["hasAvailableChapters", "true"],
    ["contentRating[]", "safe"],
    ["contentRating[]", "suggestive"],
    ["includes[]", "cover_art"],
    ["includes[]", "author"]
  ];
  if (nonEmptyString(tagId)) params.push(["includedTags[]", tagId.trim()]);
  return params;
}

function chapterSummary(entity) {
  const attributes = entity.attributes || {};
  const groupNames = relationshipNames(entity, "scanlation_group");
  const pages = Number(attributes.pages);
  const chapter = {
    id: String(entity.id),
    chapter: attributes.chapter === null || attributes.chapter === undefined
      ? null
      : String(attributes.chapter),
    pages: Number.isInteger(pages) && pages >= 0 ? pages : 0,
    language: nonEmptyString(attributes.translatedLanguage) || "en"
  };

  if (nonEmptyString(attributes.title)) chapter.title = attributes.title;
  if (attributes.volume !== null && attributes.volume !== undefined &&
      nonEmptyString(String(attributes.volume))) {
    chapter.volume = String(attributes.volume);
  }
  if (groupNames.length) chapter.group = groupNames.join(" + ");
  if (nonEmptyString(attributes.publishAt)) chapter.publishAt = attributes.publishAt;
  return chapter;
}

async function mangaFeedPage(mangaId, offset) {
  return requestJson("/manga/" + encodeURIComponent(mangaId) + "/feed", [
    ["limit", CHAPTER_BATCH],
    ["offset", offset],
    ["translatedLanguage[]", "en"],
    ["includes[]", "scanlation_group"],
    ["order[volume]", "desc"],
    ["order[chapter]", "desc"],
    ["includeFutureUpdates", "0"],
    ["includeEmptyPages", "0"],
    ["includeFuturePublishAt", "0"],
    ["includeExternalUrl", "0"],
    ["includeUnavailable", "0"]
  ]);
}

const plugin = {
  id: "mangadex-en",
  name: "MangaDex (English)",

  async popular(offset, tagId) {
    const params = mangaListParams(offset, tagId);
    params.push(["order[followedCount]", "desc"]);
    const payload = await requestJson("/manga", params);
    return (payload.data || []).map(mangaSummary);
  },

  async search(query, offset, tagId) {
    const normalizedQuery = nonEmptyString(query);
    if (!normalizedQuery) return this.popular(offset, tagId);
    const params = mangaListParams(offset, tagId);
    params.push(["title", normalizedQuery]);
    params.push(["order[relevance]", "desc"]);
    const payload = await requestJson("/manga", params);
    return (payload.data || []).map(mangaSummary);
  },

  async detail(id) {
    const payload = await requestJson(
      "/manga/" + encodeURIComponent(String(id)),
      [["includes[]", "cover_art"], ["includes[]", "author"]],
      true
    );
    return payload && payload.data ? mangaSummary(payload.data) : null;
  },

  async chapters(id) {
    const mangaId = String(id);
    const first = await mangaFeedPage(mangaId, 0);
    const entities = Array.isArray(first.data) ? first.data.slice() : [];
    const reportedTotal = Number.isFinite(Number(first.total)) ? Number(first.total) : entities.length;
    const target = Math.min(Math.max(reportedTotal, entities.length), MAX_CHAPTERS);

    while (entities.length < target) {
      // MangaDex's global public limit is 5 requests/second. Long series may
      // require several 500-chapter batches, so leave headroom between them.
      await delay(225);
      const next = await mangaFeedPage(mangaId, entities.length);
      const batch = Array.isArray(next.data) ? next.data : [];
      if (!batch.length) break;
      for (const entity of batch) {
        if (entities.length >= MAX_CHAPTERS) break;
        entities.push(entity);
      }
    }

    return entities.slice(0, MAX_CHAPTERS).map(chapterSummary);
  },

  async pageUrls(chapterId) {
    const payload = await requestJson(
      "/at-home/server/" + encodeURIComponent(String(chapterId)),
      [["forcePort443", "true"]]
    );
    const baseUrl = nonEmptyString(payload.baseUrl).replace(/\/$/, "");
    const chapter = payload.chapter || {};
    const hash = nonEmptyString(chapter.hash);
    const files = Array.isArray(chapter.data) ? chapter.data : [];
    if (!/^https?:\/\//i.test(baseUrl) || !hash) return [];
    return files.slice(0, 2000).map(function (file) {
      return baseUrl + "/data/" + encodeURIComponent(hash) + "/" + encodeURIComponent(file);
    });
  },

  async tags() {
    const payload = await requestJson("/manga/tag");
    const tags = [];
    for (const entity of payload.data || []) {
      const attributes = entity.attributes || {};
      const name = firstLocalized(attributes.name, "en");
      if (!entity.id || !name) continue;
      const tag = { id: String(entity.id), name };
      if (nonEmptyString(attributes.group)) tag.group = attributes.group;
      tags.push(tag);
    }
    tags.sort(function (a, b) {
      const groupOrder = (a.group || "").localeCompare(b.group || "");
      return groupOrder || a.name.localeCompare(b.name);
    });
    return tags;
  }
};

harbor.register(plugin);
