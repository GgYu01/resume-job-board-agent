import { detectAccessLimited } from "../extract/collect-links.mjs";

function classifyPage({ text = "", cookies = [], url = "" } = {}) {
  const accessLimited = detectAccessLimited(text);
  const loginRequired = /登录|注册|扫码|手机号|密码登录|login|sign\s*in/i.test(text);
  const loginPageSignals = /登录\s*\/\s*注册|登录账号|立即登录|登录查看完整内容|\/web\/user\//i.test(`${text} ${url || ""}`);
  const loggedInSignals = /我的简历|我的猎聘|沟通|消息|已投递|职位推荐|我的BOSS/i.test(text);
  const authCookieNameHints = cookies
    .map((cookie) => String(cookie.name || ""))
    .filter((name) => /token|auth|sid|session|login|uid|user|passport|ticket|wt2|zp|boss|liepin/i.test(name));

  let status = "unknown";
  if (accessLimited) status = "needs-user-action";
  else if (loginPageSignals) status = authCookieNameHints.length ? "needs-user-action" : "login-required";
  else if (loggedInSignals && !loginRequired) status = "logged-in";
  else if (loginRequired && !authCookieNameHints.length) status = "login-required";
  else if (authCookieNameHints.length || cookies.length >= 4) status = "probably-logged-in";

  return {
    status,
    page: {
      loginRequired,
      loginPageSignals,
      loggedInSignals,
      accessLimited,
      textLength: String(text).length,
    },
    cookies: {
      count: cookies.length,
      authNameHintCount: authCookieNameHints.length,
    },
  };
}

export function createMockCdp({ pages = [], createTargetTextByUrl = {} } = {}) {
  const state = {
    pages: pages.map((page, index) => ({ id: page.id || `page-${index + 1}`, ...page })),
    createTargetTextByUrl,
    nextTarget: 1,
  };
  return {
    async listPages() {
      return state.pages;
    },
    async createTarget(url) {
      const id = `target-${state.nextTarget}`;
      state.nextTarget += 1;
      const page = {
        id,
        targetId: id,
        url,
        text: state.createTargetTextByUrl[url] || "",
        cookies: [],
      };
      state.pages.push(page);
      return page;
    },
    async inspectPage(id) {
      return state.pages.find((page) => page.id === id || page.targetId === id);
    },
  };
}

export async function runAuthProbe(cdp, { url }) {
  const pages = await cdp.listPages();
  const page = pages.find((candidate) => candidate.url === url) || pages[0] || { url, text: "", cookies: [] };
  return {
    url: page.url,
    ...classifyPage(page),
  };
}

export async function runOpenBatch(cdp, { records = [], stopOnAccessLimited = true } = {}) {
  const opened = [];
  const accessLimited = [];
  for (const record of records) {
    const page = await cdp.createTarget(record.url);
    const openedRecord = { ...record, targetId: page.targetId };
    opened.push(openedRecord);
    if (detectAccessLimited(page.text, page.url)) {
      accessLimited.push(openedRecord);
      if (stopOnAccessLimited) break;
    }
  }
  return {
    opened,
    accessLimited,
    paused: Boolean(stopOnAccessLimited && accessLimited.length),
  };
}
