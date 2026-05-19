import assert from "node:assert/strict";
import test from "node:test";

import { createMockCdp, runAuthProbe, runOpenBatch } from "../../src/cdp/mock-cdp.mjs";

test("mock CDP auth classifies access-limited pages as user action required", async () => {
  const cdp = createMockCdp({
    pages: [
      {
        id: "boss-auth",
        url: "https://www.zhipin.com/web/geek/jobs",
        text: "安全验证 验证码",
        cookies: [{ name: "wt2" }],
      },
    ],
  });

  const result = await runAuthProbe(cdp, { site: "boss", url: "https://www.zhipin.com/web/geek/jobs" });
  assert.equal(result.status, "needs-user-action");
  assert.equal(result.page.accessLimited, true);
});

test("mock CDP auth does not treat stale BOSS cookies plus login UI as logged in", async () => {
  const cdp = createMockCdp({
    pages: [
      {
        id: "boss-login",
        url: "https://www.zhipin.com/web/user/",
        text: "登录/注册 登录账号，查看更多好职位 立即登录 消息 沟通",
        cookies: [{ name: "wt2" }, { name: "zp_token" }],
      },
    ],
  });

  const result = await runAuthProbe(cdp, { site: "boss", url: "https://www.zhipin.com/web/geek/jobs" });
  assert.equal(result.status, "needs-user-action");
  assert.equal(result.page.loginPageSignals, true);
});

test("mock CDP open batch stops when opened detail page is access limited", async () => {
  const cdp = createMockCdp({
    pages: [],
    createTargetTextByUrl: {
      "https://www.zhipin.com/job_detail/a.html": "AI Agent 工程师",
      "https://www.zhipin.com/job_detail/b.html": "访问过于频繁 captcha",
    },
  });

  const result = await runOpenBatch(cdp, {
    records: [
      { id: "a", url: "https://www.zhipin.com/job_detail/a.html" },
      { id: "b", url: "https://www.zhipin.com/job_detail/b.html" },
    ],
    stopOnAccessLimited: true,
  });

  assert.equal(result.opened.length, 2);
  assert.equal(result.accessLimited.length, 1);
  assert.equal(result.paused, true);
});
