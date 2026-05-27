import * as cheerio from "cheerio";

const MAX_TEXT_CHARS = 48_000;
const MAX_IMAGE_URLS = 40;

function absolutizeUrl(src: string, pageUrl: string) {
  try {
    return new URL(src, pageUrl).href;
  } catch {
    return null;
  }
}

export function prepareHtmlForAi(html: string, pageUrl: string) {
  const $ = cheerio.load(html);

  $("script, style, noscript, svg, iframe").remove();

  const title = $("title").first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ??
    $('meta[property="og:description"]').attr("content")?.trim() ??
    "";
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() ?? "";

  const jsonLdBlocks: string[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text().trim();
    if (raw) {
      jsonLdBlocks.push(raw.slice(0, 4000));
    }
  });

  const imageUrls = new Set<string>();
  $("img[src]").each((_, element) => {
    const src = $(element).attr("src");
    if (!src || src.startsWith("data:")) return;
    const absolute = absolutizeUrl(src, pageUrl);
    if (absolute) {
      imageUrls.add(absolute);
    }
  });

  $('meta[property="og:image"], meta[property="og:image:url"]').each((_, element) => {
    const content = $(element).attr("content");
    if (!content) return;
    const absolute = absolutizeUrl(content, pageUrl);
    if (absolute) {
      imageUrls.add(absolute);
    }
  });

  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);

  return {
    pageUrl,
    title,
    ogTitle,
    metaDescription,
    bodyText,
    jsonLdBlocks: jsonLdBlocks.slice(0, 5),
    imageUrls: [...imageUrls].slice(0, MAX_IMAGE_URLS),
  };
}

export function buildAiListingPromptPayload(
  prepared: ReturnType<typeof prepareHtmlForAi>,
) {
  return {
    source_url: prepared.pageUrl,
    page_title: prepared.title,
    open_graph_title: prepared.ogTitle,
    meta_description: prepared.metaDescription,
    discovered_image_urls: prepared.imageUrls,
    json_ld_blocks: prepared.jsonLdBlocks,
    visible_text: prepared.bodyText,
  };
}
