import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import {
  contactActionLabels,
  contactActionFailures,
  contactTriggerExpression,
  contactVerificationExpression,
} from "../../src/sites/contact-actions.mjs";
import { createContactActionRunner } from "../../src/cli/runtime.mjs";

class FakeElement {
  constructor({ tag = "div", text = "", className = "", attrs = {}, visible = true, parent = null } = {}) {
    this.tagName = tag.toUpperCase();
    this.innerText = text;
    this.textContent = text;
    this.className = className;
    this.attrs = new Map(Object.entries(attrs));
    this.visible = visible;
    this.parentElement = parent;
    this.clicked = 0;
    this.disabled = false;
    this.href = attrs.href || "";
  }

  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }

  closest(selector) {
    if (matchesSelector(this, selector)) return this;
    return this.parentElement?.closest?.(selector) || null;
  }

  getBoundingClientRect() {
    return this.visible ? { width: 150, height: 45, x: 0, y: 0 } : { width: 0, height: 0, x: 0, y: 0 };
  }

  scrollIntoView() {}

  click() {
    this.clicked += 1;
  }
}

function matchesSelector(el, selector) {
  const parts = selector.split(",").map((part) => part.trim());
  return parts.some((part) => {
    if (part === "button") return el.tagName === "BUTTON";
    if (part === "a") return el.tagName === "A";
    if (part === "div") return el.tagName === "DIV";
    if (part === "span") return el.tagName === "SPAN";
    if (part === "textarea") return el.tagName === "TEXTAREA";
    if (part === "input") return el.tagName === "INPUT";
    if (part === "[contenteditable='true']" || part === "[contenteditable=true]") return el.getAttribute("contenteditable") === "true";
    if (part === "[role='button']" || part === "[role=button]") return el.getAttribute("role") === "button";
    if (part.startsWith(".")) return String(el.className || "").split(/\s+/).includes(part.slice(1));
    return false;
  });
}

function runBrowserExpression(expression, elements, { url = "https://example.test/", title = "Test" } = {}) {
  const document = {
    title,
    location: { href: url },
    querySelectorAll(selector) {
      return elements.filter((el) => matchesSelector(el, selector));
    },
  };
  const context = {
    document,
    location: { href: url },
    window: {
      frames: [],
      getComputedStyle(el) {
        return {
          display: el.visible ? "block" : "none",
          visibility: "visible",
          opacity: "1",
        };
      },
    },
  };
  return JSON.parse(vm.runInNewContext(expression, context));
}

test("contact action labels target explicit site communication buttons", () => {
  assert.deepEqual(contactActionLabels("boss"), ["立即沟通", "继续沟通"]);
  assert.deepEqual(contactActionLabels("liepin"), ["聊一聊"]);
  assert.deepEqual(contactActionLabels("51job"), []);
});

test("contact trigger expression carries the site-specific button label", () => {
  assert.match(contactTriggerExpression("boss"), /\\u7acb\\u5373\\u6c9f\\u901a/);
  assert.match(contactTriggerExpression("boss"), /\\u7ee7\\u7eed\\u6c9f\\u901a/);
  assert.match(contactTriggerExpression("liepin"), /\\u804a\\u4e00\\u804a/);
});

test("contact trigger expression clicks BOSS start-chat controls from real detail DOM shape", () => {
  const container = new FakeElement({ className: "btn-container", text: "感兴趣 继续沟通" });
  const interest = new FakeElement({ tag: "a", className: "btn btn-interest", text: "感兴趣", parent: container });
  const startChat = new FakeElement({ tag: "a", className: "btn btn-startchat", text: "继续沟通", parent: container });

  const result = runBrowserExpression(contactTriggerExpression("boss"), [container, interest, startChat], {
    url: "https://www.zhipin.com/job_detail/example.html",
    title: "BOSS detail",
  });

  assert.equal(result.clicked, true);
  assert.equal(result.label, "继续沟通");
  assert.equal(startChat.clicked, 1);
  assert.equal(container.clicked, 0);
  assert.equal(interest.clicked, 0);
});

test("contact trigger expression clicks Liepin detail-page chat buttons", () => {
  const operate = new FakeElement({ className: "job-apply-operate", text: "聊一聊 收藏 微信分享扫码" });
  const chat = new FakeElement({ tag: "a", className: "btn-main", text: "聊一聊", parent: operate });

  const result = runBrowserExpression(contactTriggerExpression("liepin"), [operate, chat], {
    url: "https://www.liepin.com/a/74696909.shtml",
    title: "Liepin detail",
  });

  assert.equal(result.clicked, true);
  assert.equal(result.label, "聊一聊");
  assert.equal(chat.clicked, 1);
  assert.equal(operate.clicked, 0);
});

test("contact verification expression does not treat a bare BOSS continue button as triggered", () => {
  const startChat = new FakeElement({ tag: "a", className: "btn btn-startchat", text: "继续沟通" });

  const result = runBrowserExpression(contactVerificationExpression("boss"), [startChat], {
    url: "https://www.zhipin.com/job_detail/example.html",
    title: "BOSS detail",
  });

  assert.equal(result.verified, false);
  assert.equal(result.status, "existing-conversation-marker");
  assert.equal(result.alreadyContacted, true);
});

test("contact verification expression treats an opened BOSS chat UI as verified", () => {
  const chatShell = new FakeElement({ className: "zpchat chat-modal", text: "沟通 请输入消息" });
  const input = new FakeElement({ tag: "textarea", className: "chat-input", attrs: { placeholder: "请输入消息" }, parent: chatShell });

  const result = runBrowserExpression(contactVerificationExpression("boss"), [chatShell, input], {
    url: "https://www.zhipin.com/job_detail/example.html",
    title: "BOSS detail",
  });

  assert.equal(result.verified, true);
  assert.equal(result.status, "conversation-opened");
  assert.equal(result.conversationOpen, true);
});

test("contact verification expression does not treat a bare Liepin chat button as sent", () => {
  const chat = new FakeElement({ tag: "a", className: "btn-chat", text: "聊一聊" });

  const result = runBrowserExpression(contactVerificationExpression("liepin"), [chat], {
    url: "https://www.liepin.com/a/74696909.shtml",
    title: "Liepin detail",
  });

  assert.equal(result.verified, false);
  assert.equal(result.status, "not-verified");
  assert.equal(result.messageSent, false);
});

test("contact verification expression does not treat generic homepage dialog classes as chat", () => {
  const shell = new FakeElement({ className: "conversation dialog", text: "推荐 职位 搜索 消息" });
  const floatingEntry = new FakeElement({ className: "im-ui-basic-entry im-ui-basic-entry-c", text: "我的沟通" });

  const result = runBrowserExpression(contactVerificationExpression("liepin"), [shell, floatingEntry], {
    url: "https://c.liepin.com/",
    title: "我的首页_猎聘",
  });

  assert.equal(result.verified, false);
  assert.equal(result.status, "not-verified");
  assert.equal(result.conversationOpen, false);
});

test("contact action runner retries when a clicked BOSS continue button is not strictly verified", async () => {
  const target = {
    id: "boss-detail",
    type: "page",
    url: "https://www.zhipin.com/job_detail/example.html",
    webSocketDebuggerUrl: "ws://example",
  };
  const evaluations = [
    { clicked: true, label: "继续沟通", targetText: "继续沟通" },
    { verified: true, status: "existing-conversation-marker", alreadyContacted: true, conversationOpen: false, messageSent: false },
    { clicked: true, label: "继续沟通", targetText: "继续沟通" },
    { verified: true, status: "conversation-opened", alreadyContacted: true, conversationOpen: true, messageSent: false },
  ];
  const runner = createContactActionRunner({
    listTargets: async () => [target],
    evaluateTarget: async () => evaluations.shift(),
    delay: async () => {},
  });

  const [action] = await runner.triggerContactActions(9222, [
    { id: "boss-ai", site: "boss", url: target.url, targetId: target.id },
  ], {
    enabled: true,
    delayMs: 0,
    verifyDelayMs: 0,
    retryDelayMs: 0,
    maxAttempts: 2,
    betweenRecordsDelayMs: 0,
  });

  assert.equal(action.verified, true);
  assert.equal(action.attemptCount, 2);
  assert.equal(action.attempts[0].verified, false);
  assert.equal(action.verification.status, "conversation-opened");
});

test("contact action failures include exhausted supported-site contact attempts", () => {
  const failures = contactActionFailures([
    { id: "boss-a", site: "boss", attempted: true, clicked: false, verified: false, error: "contact-not-verified-after-2-attempts" },
    { id: "51job-a", site: "51job", attempted: false, clicked: false, verified: false },
  ]);

  assert.equal(failures.length, 1);
  assert.equal(failures[0].id, "boss-a");
});
