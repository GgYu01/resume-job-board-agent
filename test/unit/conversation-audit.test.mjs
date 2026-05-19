import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import {
  conversationListExpression,
  conversationSelectExpression,
  sanitizeConversationAuditResult,
  summarizeConversationAuditResults,
} from "../../src/sites/conversation-audit.mjs";

class FakeElement {
  constructor({ tag = "div", text = "", className = "", attrs = {}, visible = true, onClick = null } = {}) {
    this.tagName = tag.toUpperCase();
    this._text = text;
    this.className = className;
    this.attrs = new Map(Object.entries(attrs));
    this.visible = visible;
    this.onClick = onClick;
    this.children = [];
    this.parentElement = null;
    this.clicked = 0;
  }

  get innerText() {
    return elementText(this);
  }

  get textContent() {
    return elementText(this);
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
    return this;
  }

  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }

  closest(selector) {
    if (matchesSelector(this, selector)) return this;
    return this.parentElement?.closest?.(selector) || null;
  }

  querySelectorAll(selector) {
    const out = [];
    const selectors = selector.split(",").map((item) => item.trim()).filter(Boolean);
    const visit = (node) => {
      for (const child of node.children) {
        if (selectors.some((part) => matchesSelector(child, part))) out.push(child);
        visit(child);
      }
    };
    visit(this);
    return out;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  getBoundingClientRect() {
    return this.visible
      ? { width: 240, height: 52, x: 10, y: 10, left: 10, top: 10, right: 250, bottom: 62 }
      : { width: 0, height: 0, x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0 };
  }

  scrollIntoView() {}

  click() {
    this.clicked += 1;
    if (this.onClick) this.onClick(this);
  }
}

function elementText(node) {
  return [node._text, ...node.children.map((child) => elementText(child))]
    .filter(Boolean)
    .join("\n");
}

function matchesSelector(el, selector) {
  if (!selector) return false;
  if (selector === "*") return true;
  if (/^[a-z]+$/i.test(selector)) return el.tagName.toLowerCase() === selector.toLowerCase();
  if (selector === "[class]") return Boolean(el.className);
  if (selector === "[role='button']") return el.getAttribute("role") === "button";
  if (selector.startsWith(".")) return String(el.className || "").split(/\s+/).includes(selector.slice(1));
  if (/^\[class\*=['"]?([^'"\]]+)['"]?\]$/i.test(selector)) {
    const [, term] = selector.match(/^\[class\*=['"]?([^'"\]]+)['"]?\]$/i);
    return String(el.className || "").includes(term);
  }
  return false;
}

async function runBrowserExpression(expression, body, { url = "https://www.zhipin.com/web/geek/chat", title = "BOSS直聘" } = {}) {
  const context = {
    window: {
      innerWidth: 1280,
      frames: [],
      getComputedStyle: (el) => ({
        display: el?.visible === false ? "none" : "block",
        visibility: el?.visible === false ? "hidden" : "visible",
        opacity: "1",
      }),
    },
    document: {
      title,
      body,
      querySelectorAll: (selector) => body.querySelectorAll(selector),
    },
    location: { href: url },
    setTimeout,
    clearTimeout,
  };
  context.window.document = context.document;
  context.globalThis = context;
  const result = vm.runInNewContext(expression, context);
  const value = result && typeof result.then === "function" ? await result : result;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function buildConversationPage() {
  const first = new FakeElement({ className: "conversation-item active", text: "刘女士\nAI Agent 架构工程师\n昨天 23:18" });
  const second = new FakeElement({ className: "conversation-item", text: "张先生\n测试开发工程师\n05月18日" });
  const list = new FakeElement({ className: "chat-list" }).append(first, second);
  const toolbar = new FakeElement({ className: "chat-controls" }).append(
    new FakeElement({ tag: "button", className: "toolbar-btn", text: "发简历" }),
  );
  const active = new FakeElement({ className: "chat-conversation" }).append(
    new FakeElement({ className: "message-content", text: "你好，我想应聘贵公司的AI Agent工程师" }),
    toolbar,
  );
  const body = new FakeElement({ tag: "body" }).append(list, active);
  return { body, first, second };
}

test("conversationListExpression extracts sidebar conversations and excludes toolbar actions", async () => {
  const { body } = buildConversationPage();

  const result = await runBrowserExpression(conversationListExpression("boss", { max: 5 }), body);

  assert.equal(result.site, "boss");
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.candidates.map((item) => item.textSample.split("\n")[0]), ["刘女士", "张先生"]);
  assert.ok(result.candidates.every((item) => item.auditKey));
  assert.ok(result.candidates.every((item) => Number.isInteger(item.index)));
  assert.ok(result.candidates.every((item) => item.selectorHint));
  assert.equal(result.candidates[0].active, true);
});

test("conversationSelectExpression clicks the selected conversation by audit key", async () => {
  const { body, second } = buildConversationPage();
  const listed = await runBrowserExpression(conversationListExpression("boss", { max: 5 }), body);

  const result = await runBrowserExpression(conversationSelectExpression("boss", {
    auditKey: listed.candidates[1].auditKey,
  }), body);

  assert.equal(result.selected, true);
  assert.equal(result.candidate.textSample.split("\n")[0], "张先生");
  assert.equal(second.clicked, 1);
});

test("conversationSelectExpression clicks BOSS friend-content child when wrapper is listed", async () => {
  const child = new FakeElement({
    className: "friend-content friend-top",
    text: "05月18日 许女士 AI智能办公工程师",
  });
  const wrapper = new FakeElement({ className: "friend-content-warp" }).append(child);
  const list = new FakeElement({ className: "user-list-content" }).append(wrapper);
  const body = new FakeElement({ tag: "body" }).append(list);
  const listed = await runBrowserExpression(conversationListExpression("boss", { max: 5 }), body);

  assert.equal(listed.candidates.length, 1);
  assert.equal(listed.candidates[0].selectorHint, "div.friend-content-warp");

  const result = await runBrowserExpression(conversationSelectExpression("boss", {
    auditKey: listed.candidates[0].auditKey,
  }), body);

  assert.equal(result.selected, true);
  assert.equal(wrapper.clicked, 0);
  assert.equal(child.clicked, 1);
  assert.equal(result.clickedTarget.selectorHint, "div.friend-content.friend-top");
});

test("summarizeConversationAuditResults counts exchange action states", () => {
  const summary = summarizeConversationAuditResults([
    {
      followup: {
        actions: [
          { type: "resume", status: "available", available: true },
          { type: "wechat", status: "platform-unavailable", unavailable: true },
        ],
      },
    },
    {
      followup: {
        actions: [
          { type: "resume", status: "clicked", clicked: true },
          { type: "wechat", status: "already-satisfied", alreadySatisfied: true },
        ],
      },
    },
  ]);

  assert.equal(summary.conversation_count, 2);
  assert.equal(summary.available_resume_count, 1);
  assert.equal(summary.platform_unavailable_count, 1);
  assert.equal(summary.clicked_resume_count, 1);
  assert.equal(summary.already_satisfied_count, 1);
});

test("sanitizeConversationAuditResult redacts nested contact values", () => {
  const sanitized = sanitizeConversationAuditResult({
    candidate: { textSample: "孙先生 wxid_abcd1234 13812345678" },
    followup: {
      textSample: "微信 wxid_abcd1234，电话 13812345678",
      trace: [
        { step: "sample", sample: "VX: abcdefg", targetText: "微信 wxid_abcd1234" },
      ],
    },
  });

  const text = JSON.stringify(sanitized);
  assert.equal(text.includes("wxid_abcd1234"), false);
  assert.equal(text.includes("13812345678"), false);
  assert.match(text, /redacted/);
});
