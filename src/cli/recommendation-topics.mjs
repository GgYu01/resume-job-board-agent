const BOSS_TOPIC_SELECTORS = [".expect-list a.expect-item"];

export function recommendationTopicSelectors(site = "both") {
  const normalized = String(site || "both").toLowerCase();
  if (normalized === "both" || normalized === "boss") return [...BOSS_TOPIC_SELECTORS];
  return [];
}

export function buildRecommendationTopicExpression({
  site = "both",
  maxTopics = 4,
  waitMs = 1600,
} = {}) {
  const siteLiteral = JSON.stringify(String(site || "both").toLowerCase());
  const selectorsLiteral = JSON.stringify(recommendationTopicSelectors(site));
  const maxTopicsLiteral = JSON.stringify(Math.max(0, Number(maxTopics) || 0));
  const waitMsLiteral = JSON.stringify(Math.max(0, Number(waitMs) || 0));

  return `(async () => {
    const wantedSite = ${siteLiteral};
    const selectors = ${selectorsLiteral};
    const maxTopics = ${maxTopicsLiteral};
    const waitMs = ${waitMsLiteral};
    const norm = (s) => String(s || "")
      .replace(/\\u00a0/g, " ")
      .replace(/[ \\t]+/g, " ")
      .replace(/\\n{3,}/g, "\\n\\n")
      .trim();
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const filteredSearch = (parsed) => {
      const allowed = new Set(["securityId", "lid", "ka"]);
      const rawSearch = String(parsed.search || "").replace(/^\\?/, "");
      if (!rawSearch) return "";
      const pairs = rawSearch.split("&").filter((pair) => {
        const rawName = pair.split("=", 1)[0].replace(/\\+/g, " ");
        let name = rawName;
        try { name = decodeURIComponent(rawName); } catch (e) {}
        return allowed.has(name);
      });
      return pairs.length ? "?" + pairs.join("&") : "";
    };
    const canon = (href) => {
      let parsed = null;
      let url = "";
      try {
        parsed = new URL(href, location.href);
        url = parsed.href;
      } catch (e) {
        return null;
      }
      let m = url.match(/https?:\\/\\/(?:www\\.)?liepin\\.com\\/((?:job|a)\\/(\\d+)\\.shtml)/i);
      if (m && (wantedSite === "both" || wantedSite === "liepin")) {
        return { site: "liepin", id: m[2], url: "https://www.liepin.com/" + m[1] };
      }
      m = url.match(/https?:\\/\\/(?:www\\.)?liepin\\.com\\/lptjob\\/(\\d+)/i);
      if (m && (wantedSite === "both" || wantedSite === "liepin")) {
        return { site: "liepin", id: m[1], url: "https://www.liepin.com/lptjob/" + m[1] };
      }
      m = url.match(/https?:\\/\\/(?:www\\.)?zhipin\\.com\\/job_detail\\/([^/?#]+)\\.html/i);
      if (m && (wantedSite === "both" || wantedSite === "boss")) {
        return { site: "boss", id: m[1], url: "https://www.zhipin.com/job_detail/" + m[1] + ".html" + filteredSearch(parsed) };
      }
      m = url.match(/https?:\\/\\/jobs\\.51job\\.com\\/([^/?#]+)\\/(\\d+)\\.html/i);
      if (m && (wantedSite === "both" || wantedSite === "51job")) {
        return { site: "51job", id: m[2], url: "https://jobs.51job.com/" + m[1] + "/" + m[2] + ".html" };
      }
      return null;
    };
    const detectAccessLimited = () => {
      const body = norm(document.body ? document.body.innerText : "");
      return /captcha|verify|safe\\.liepin\\.com|verify\\.zhipin\\.com/i.test(body + " " + location.href);
    };
    const extractItems = (topic) => {
      const items = [];
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      for (const anchor of anchors) {
        const c = canon(anchor.href);
        if (!c) continue;
        let best = "";
        let el = anchor;
        for (let depth = 0; el && depth < 8; depth += 1, el = el.parentElement) {
          const text = norm(el.innerText || el.textContent || "");
          if (text.length > best.length && text.length < 1200) best = text;
          if (text.length > 40 && text.length < 700) {
            best = text;
            break;
          }
        }
        items.push({
          site: c.site,
          id: c.id,
          url: c.url,
          titleText: norm(anchor.innerText || anchor.textContent || ""),
          cardText: best,
          sourceUrl: location.href,
          sourceTitle: document.title || "",
          collectionReason: "recommendation-topic-tab",
          recommendationTopic: topic,
        });
      }
      return items;
    };
    const readTopics = () => {
      const seen = new Set();
      const topics = [];
      for (const selector of selectors) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
          if (!visible(element)) continue;
          const text = norm(element.innerText || element.textContent || "");
          if (!text || seen.has(text)) continue;
          seen.add(text);
          topics.push({ text, element });
        }
      }
      return topics;
    };
    const topicTexts = readTopics().slice(0, maxTopics).map((topic) => topic.text);
    const topics = [];
    for (const topicText of topicTexts) {
      const topic = readTopics().find((candidate) => candidate.text === topicText);
      if (!topic) {
        topics.push({
          collectionReason: "recommendation-topic-tab",
          topic: topicText,
          url: location.href,
          title: document.title || "",
          accessLimited: detectAccessLimited(),
          items: [],
          warning: "topic-not-found-after-refresh",
        });
        continue;
      }
      try {
        topic.element.scrollIntoView({ block: "center", inline: "center" });
        topic.element.click();
      } catch (error) {
        topics.push({
          collectionReason: "recommendation-topic-tab",
          topic: topicText,
          url: location.href,
          title: document.title || "",
          accessLimited: detectAccessLimited(),
          items: [],
          warning: "topic-click-failed: " + (error && error.message ? error.message : String(error)),
        });
        continue;
      }
      await wait(waitMs);
      topics.push({
        collectionReason: "recommendation-topic-tab",
        topic: topicText,
        url: location.href,
        title: document.title || "",
        accessLimited: detectAccessLimited(),
        items: extractItems(topicText),
      });
    }
    return JSON.stringify({
      url: location.href,
      title: document.title || "",
      topics,
    });
  })()`;
}
