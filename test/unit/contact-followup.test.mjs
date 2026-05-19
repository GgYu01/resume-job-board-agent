import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import {
  DEFAULT_CONTACT_FOLLOWUP_RESUME_NOTE,
  contactFollowupExpression,
  normalizeContactFollowupMessages,
  splitContactFollowupMessage,
} from "../../src/sites/contact-followup.mjs";
import { createContactActionRunner } from "../../src/cli/runtime.mjs";

class FakeElement {
  constructor({ tag = "div", text = "", className = "", attrs = {}, visible = true, onClick = null } = {}) {
    this.tagName = tag.toUpperCase();
    this._innerText = text;
    this._textContent = text;
    this.value = attrs.value || "";
    this.className = className;
    this.attrs = new Map(Object.entries(attrs));
    this.visible = visible;
    this.onClick = onClick;
    this.children = [];
    this.parentElement = null;
    this.clicked = 0;
    this.disabled = false;
    this.href = attrs.href || "";
  }

  get innerText() {
    return elementText(this);
  }

  set innerText(value) {
    this._innerText = String(value || "");
  }

  get textContent() {
    return elementText(this);
  }

  set textContent(value) {
    this._textContent = String(value || "");
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
    return this;
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }

  setAttribute(name, value) {
    this.attrs.set(name, String(value));
  }

  closest(selector) {
    if (matchesSelector(this, selector)) return this;
    return this.parentElement?.closest?.(selector) || null;
  }

  querySelectorAll(selector) {
    const out = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (matchesSelector(child, selector)) out.push(child);
        visit(child);
      }
    };
    visit(this);
    return out;
  }

  getBoundingClientRect() {
    return this.visible
      ? { width: 150, height: 45, x: 0, y: 0, left: 0, top: 0, right: 150, bottom: 45 }
      : { width: 0, height: 0, x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0 };
  }

  focus() {}

  scrollIntoView() {}

  dispatchEvent() {
    return true;
  }

  click() {
    this.clicked += 1;
    if (this.onClick) this.onClick(this);
  }
}

function appendModal(body, label, onClick) {
  const modal = new FakeElement({ className: "ant-im-modal ant-im-modal-content", attrs: { role: "dialog" } });
  const button = new FakeElement({
    tag: "button",
    text: label,
    className: "ant-im-btn ant-im-btn-primary",
    onClick: () => {
      modal.remove();
      if (onClick) onClick();
    },
  });
  modal.append(button);
  body.append(modal);
  return button;
}

function matchesSelector(el, selector) {
  const parts = selector.split(",").map((part) => part.trim());
  return parts.some((part) => {
    if (part === "*") return true;
    if (part === "button") return el.tagName === "BUTTON";
    if (part === "a") return el.tagName === "A";
    if (part === "div") return el.tagName === "DIV";
    if (part === "span") return el.tagName === "SPAN";
    if (part === "label") return el.tagName === "LABEL";
    if (part === "li") return el.tagName === "LI";
    if (part === "textarea") return el.tagName === "TEXTAREA";
    if (part === "input") return el.tagName === "INPUT";
    if (part === "main") return el.tagName === "MAIN";
    if (part === "section") return el.tagName === "SECTION";
    if (part === "[contenteditable='true']" || part === "[contenteditable=true]") return el.getAttribute("contenteditable") === "true";
    if (part === "[role='button']" || part === "[role=button]" || part === "[role=\"button\"]") return el.getAttribute("role") === "button";
    if (part === "[role='dialog']" || part === "[role=dialog]" || part === "[role=\"dialog\"]") return el.getAttribute("role") === "dialog";
    if (part === "[role='radio']" || part === "[role=radio]" || part === "[role=\"radio\"]") return el.getAttribute("role") === "radio";
    if (part === "[role='checkbox']" || part === "[role=checkbox]" || part === "[role=\"checkbox\"]") return el.getAttribute("role") === "checkbox";
    if (part.startsWith(".")) return String(el.className || "").split(/\s+/).includes(part.slice(1));
    return false;
  });
}

function elementText(node) {
  return [node._innerText, node._textContent, node.value, ...node.children.map(elementText)]
    .filter(Boolean)
    .join(" ");
}

async function runBrowserExpression(expression, body, { url = "https://c.liepin.com/", title = "我的首页_猎聘" } = {}) {
  const document = {
    title,
    body,
    location: { href: url },
    querySelectorAll(selector) {
      const out = matchesSelector(body, selector) ? [body] : [];
      return [...out, ...body.querySelectorAll(selector)];
    },
  };
  Object.defineProperty(body, "innerText", {
    get() {
      return elementText(body);
    },
    configurable: true,
  });
  Object.defineProperty(body, "textContent", {
    get() {
      return elementText(body);
    },
    configurable: true,
  });
  const context = {
    document,
    location: { href: url },
    setTimeout,
    Event: class Event {},
    InputEvent: class InputEvent {},
    KeyboardEvent: class KeyboardEvent {},
    HTMLTextAreaElement: class HTMLTextAreaElement {},
    HTMLInputElement: class HTMLInputElement {},
    window: {
      frames: [],
      HTMLTextAreaElement: class HTMLTextAreaElement {},
      HTMLInputElement: class HTMLInputElement {},
      getComputedStyle(el) {
        return {
          display: el.visible ? "block" : "none",
          visibility: "visible",
          opacity: "1",
        };
      },
    },
  };
  const raw = await vm.runInNewContext(expression, context);
  return JSON.parse(raw);
}

test("contact follow-up expression clicks Liepin resume and WeChat controls then sends messages", async () => {
  const transcript = new FakeElement({ className: "im-ui-message-list-wrapper", text: "历史沟通" });
  const textarea = new FakeElement({
    tag: "textarea",
    className: "ant-im-input ant-im-input-borderless im-ui-textarea",
    attrs: { placeholder: "请输入文字，按Enter键发送" },
  });
  const resume = new FakeElement({ tag: "span", text: "发简历", className: "im-ui-action-button action-item action-resume" });
  const wechat = new FakeElement({ tag: "span", text: "交换微信号", className: "im-ui-action-button action-item action-wechat" });
  const send = new FakeElement({
    tag: "button",
    text: "发送",
    className: "ant-im-btn ant-im-btn-primary im-ui-basic-send-btn ant-im-teno-btn",
    onClick: () => {
      transcript.innerText = `${transcript.innerText} ${textarea.value}`;
      transcript.textContent = transcript.innerText;
    },
  });
  const root = new FakeElement({ className: "im-ui-chat-container" }).append(
    transcript,
    new FakeElement({ className: "chatwin-action" }).append(resume, wechat),
    new FakeElement({ className: "im-ui-input-content" }).append(textarea),
    new FakeElement({ className: "im-ui-input-actions" }).append(send),
  );
  const body = new FakeElement({ tag: "body" }).append(root);

  const result = await runBrowserExpression(contactFollowupExpression("liepin", {
    messages: ["您好，我这边目前在职，到岗时间可以沟通。"],
    stepDelayMs: 0,
    verifyDelayMs: 0,
  }), body);

  assert.equal(result.verified, true);
  assert.equal(result.status, "followup-sent");
  assert.equal(result.clickedExchangeCount, 2);
  assert.equal(result.sentMessageCount, 2);
  assert.equal(resume.clicked, 1);
  assert.equal(wechat.clicked, 1);
  assert.equal(send.clicked, 2);
  assert.match(transcript.innerText, /这是我的简历/);
  assert.match(transcript.innerText, /目前在职/);
});

test("contact follow-up drains multi-step exchange confirmations and records reviewable trace", async () => {
  const transcript = new FakeElement({ className: "im-ui-message-list-wrapper", text: "历史沟通" });
  const textarea = new FakeElement({
    tag: "textarea",
    className: "ant-im-input ant-im-input-borderless im-ui-textarea",
    attrs: { placeholder: "请输入文字，按Enter键发送" },
  });
  const body = new FakeElement({ tag: "body" });
  const resume = new FakeElement({
    tag: "span",
    text: "发简历",
    className: "im-ui-action-button action-item action-resume",
    onClick: () => {
      appendModal(body, "立即投递", () => {
        appendModal(body, "确定", () => {
          transcript.innerText = `${transcript.innerText} 已发送简历`;
          transcript.textContent = transcript.innerText;
        });
      });
    },
  });
  const wechat = new FakeElement({
    tag: "span",
    text: "交换微信号",
    className: "im-ui-action-button action-item action-wechat",
    onClick: () => {
      appendModal(body, "同意", () => {
        appendModal(body, "确定", () => {
          transcript.innerText = `${transcript.innerText} 你已向对方发起索要微信号请求`;
          transcript.textContent = transcript.innerText;
        });
      });
    },
  });
  const send = new FakeElement({
    tag: "button",
    text: "发送",
    className: "ant-im-btn ant-im-btn-primary im-ui-basic-send-btn ant-im-teno-btn",
    onClick: () => {
      transcript.innerText = `${transcript.innerText} ${textarea.value}`;
      transcript.textContent = transcript.innerText;
    },
  });
  const root = new FakeElement({ className: "im-ui-chat-container" }).append(
    transcript,
    new FakeElement({ className: "chatwin-action" }).append(resume, wechat),
    new FakeElement({ className: "im-ui-input-content" }).append(textarea),
    new FakeElement({ className: "im-ui-input-actions" }).append(send),
  );
  body.append(root);

  const result = await runBrowserExpression(contactFollowupExpression("liepin", {
    messages: ["您好，我这边目前在职，到岗时间可以沟通。"],
    stepDelayMs: 0,
    verifyDelayMs: 0,
  }), body);

  const resumeAction = result.actions.find((action) => action.type === "resume");
  const wechatAction = result.actions.find((action) => action.type === "wechat");

  assert.equal(result.verified, true);
  assert.equal(resumeAction.satisfied, true);
  assert.equal(wechatAction.satisfied, true);
  assert.equal(resumeAction.confirmations.length, 2);
  assert.equal(wechatAction.confirmations.length, 2);
  assert.deepEqual(resumeAction.confirmations.map((item) => item.text), ["立即投递", "确定"]);
  assert.deepEqual(wechatAction.confirmations.map((item) => item.text), ["同意", "确定"]);
  assert.match(transcript.innerText, /已发送简历/);
  assert.match(transcript.innerText, /发起索要微信号请求/);
  assert.ok(result.trace.some((step) => step.step === "exchange.confirmation.clicked" && step.type === "wechat"));
  assert.ok(result.trace.some((step) => step.step === "message.verified" && step.verified === true));
});

test("contact follow-up selects the default-priority resume option before submitting", async () => {
  const transcript = new FakeElement({ className: "im-ui-message-list-wrapper", text: "历史沟通" });
  const textarea = new FakeElement({
    tag: "textarea",
    className: "ant-im-input ant-im-input-borderless im-ui-textarea",
    attrs: { placeholder: "请输入文字，按Enter键发送" },
  });
  const body = new FakeElement({ tag: "body" });
  let defaultOption;
  const resume = new FakeElement({
    tag: "span",
    text: "发简历",
    className: "im-ui-action-button action-item action-resume",
    onClick: () => {
      const modal = new FakeElement({ className: "ant-im-modal ant-im-modal-content", attrs: { role: "dialog" } });
      const header = new FakeElement({
        tag: "div",
        text: "选择附件简历招聘方将同时收到您的默认在线简历和附件简历",
        className: "_11156F5Qnh",
      });
      const oldOption = new FakeElement({
        tag: "div",
        text: "历史简历 2024-01-01上传",
        className: "resume-option",
        attrs: { role: "radio", "aria-checked": "false" },
      });
      defaultOption = new FakeElement({
        tag: "div",
        text: "默认 求职简历 2026-05-08上传",
        className: "resume-option default",
        attrs: { role: "radio", "aria-checked": "false" },
        onClick: () => {
          oldOption.setAttribute("aria-checked", "false");
          defaultOption.setAttribute("aria-checked", "true");
        },
      });
      const submit = new FakeElement({
        tag: "button",
        text: "立即投递",
        className: "ant-im-btn ant-im-btn-round ant-im-btn-primary",
        onClick: () => {
          modal.remove();
          transcript.innerText = defaultOption.getAttribute("aria-checked") === "true"
            ? `${transcript.innerText} 发送成功`
            : `${transcript.innerText} 错误简历`;
          transcript.textContent = transcript.innerText;
        },
      });
      modal.append(header, oldOption, defaultOption, submit);
      body.append(modal);
    },
  });
  const wechat = new FakeElement({ tag: "span", text: "交换微信号", className: "im-ui-action-button action-item action-wechat" });
  const send = new FakeElement({
    tag: "button",
    text: "发送",
    className: "ant-im-btn ant-im-btn-primary im-ui-basic-send-btn ant-im-teno-btn",
    onClick: () => {
      transcript.innerText = `${transcript.innerText} ${textarea.value}`;
      transcript.textContent = transcript.innerText;
    },
  });
  const root = new FakeElement({ className: "im-ui-chat-container" }).append(
    transcript,
    new FakeElement({ className: "chatwin-action" }).append(resume, wechat),
    new FakeElement({ className: "im-ui-input-content" }).append(textarea),
    new FakeElement({ className: "im-ui-input-actions" }).append(send),
  );
  body.append(root);

  const result = await runBrowserExpression(contactFollowupExpression("liepin", {
    messages: ["您好，我这边目前在职，到岗时间可以沟通。"],
    exchangeWechat: false,
    stepDelayMs: 0,
    verifyDelayMs: 0,
  }), body);

  const resumeAction = result.actions.find((action) => action.type === "resume");

  assert.equal(result.verified, true);
  assert.equal(defaultOption.getAttribute("aria-checked"), "true");
  assert.equal(resumeAction.resumeSelection.clicked, true);
  assert.match(resumeAction.resumeSelection.selectedText, /默认 求职简历/);
  assert.deepEqual(resumeAction.confirmations.map((item) => item.text), ["立即投递"]);
  assert.match(transcript.innerText, /发送成功/);
  assert.doesNotMatch(transcript.innerText, /错误简历/);
  assert.ok(result.trace.some((step) => step.step === "resume.selection.clicked" && /默认 求职简历/.test(step.text)));
});

test("contact follow-up keeps an already checked resume radio instead of clicking modal copy", async () => {
  const transcript = new FakeElement({ className: "im-ui-message-list-wrapper", text: "历史沟通" });
  const textarea = new FakeElement({
    tag: "textarea",
    className: "ant-im-input ant-im-input-borderless im-ui-textarea",
    attrs: { placeholder: "请输入文字，按Enter键发送" },
  });
  const body = new FakeElement({ tag: "body" });
  let checkedOption;
  const resume = new FakeElement({
    tag: "span",
    text: "发简历",
    className: "im-ui-action-button action-item action-resume",
    onClick: () => {
      const modal = new FakeElement({ className: "ant-im-modal ant-im-modal-content", attrs: { role: "dialog" } });
      const header = new FakeElement({
        tag: "div",
        text: "选择附件简历招聘方将同时收到您的默认在线简历和附件简历",
        className: "_11156F5Qnh",
        onClick: () => {
          transcript.innerText = `${transcript.innerText} 错点说明文字`;
          transcript.textContent = transcript.innerText;
        },
      });
      checkedOption = new FakeElement({
        tag: "label",
        text: "求职简历 2026-05-08上传 预览",
        className: "ant-im-radio-wrapper ant-im-radio-wrapper-checked",
        attrs: { role: "radio", "aria-checked": "true" },
      });
      const submit = new FakeElement({
        tag: "button",
        text: "立即投递",
        className: "ant-im-btn ant-im-btn-round ant-im-btn-primary",
        onClick: () => {
          modal.remove();
          transcript.innerText = `${transcript.innerText} 发送成功`;
          transcript.textContent = transcript.innerText;
        },
      });
      modal.append(header, checkedOption, submit);
      body.append(modal);
    },
  });
  const send = new FakeElement({
    tag: "button",
    text: "发送",
    className: "ant-im-btn ant-im-btn-primary im-ui-basic-send-btn ant-im-teno-btn",
    onClick: () => {
      transcript.innerText = `${transcript.innerText} ${textarea.value}`;
      transcript.textContent = transcript.innerText;
    },
  });
  const root = new FakeElement({ className: "im-ui-chat-container" }).append(
    transcript,
    new FakeElement({ className: "chatwin-action" }).append(resume),
    new FakeElement({ className: "im-ui-input-content" }).append(textarea),
    new FakeElement({ className: "im-ui-input-actions" }).append(send),
  );
  body.append(root);

  const result = await runBrowserExpression(contactFollowupExpression("liepin", {
    messages: ["您好，我这边目前在职，到岗时间可以沟通。"],
    exchangeWechat: false,
    stepDelayMs: 0,
    verifyDelayMs: 0,
  }), body);

  const resumeAction = result.actions.find((action) => action.type === "resume");

  assert.equal(result.verified, true);
  assert.equal(resumeAction.resumeSelection.status, "already-selected");
  assert.equal(resumeAction.resumeSelection.clicked, false);
  assert.match(resumeAction.resumeSelection.selectedText, /求职简历/);
  assert.equal(checkedOption.clicked, 0);
  assert.doesNotMatch(transcript.innerText, /错点说明文字/);
});

test("contact follow-up ignores stale resume modal when confirming WeChat exchange", async () => {
  const transcript = new FakeElement({ className: "im-ui-message-list-wrapper", text: "历史沟通" });
  const textarea = new FakeElement({
    tag: "textarea",
    className: "ant-im-input ant-im-input-borderless im-ui-textarea",
    attrs: { placeholder: "请输入文字，按Enter键发送" },
  });
  const body = new FakeElement({ tag: "body" });
  const resume = new FakeElement({
    tag: "span",
    text: "发简历",
    className: "im-ui-action-button action-item action-resume",
    onClick: () => {
      const staleResumeModal = new FakeElement({ className: "ant-im-modal ant-im-modal-content", attrs: { role: "dialog" } });
      staleResumeModal.append(new FakeElement({
        tag: "button",
        text: "立即投递",
        className: "ant-im-btn ant-im-btn-round ant-im-btn-primary",
        onClick: () => {
          transcript.innerText = `${transcript.innerText} 发送成功`;
          transcript.textContent = transcript.innerText;
        },
      }));
      body.append(staleResumeModal);
    },
  });
  const wechat = new FakeElement({
    tag: "span",
    text: "交换微信号",
    className: "im-ui-action-button action-item action-wechat",
    onClick: () => {
      appendModal(body, "确定", () => {
        transcript.innerText = `${transcript.innerText} 你已向对方发起索要微信号请求`;
        transcript.textContent = transcript.innerText;
      });
    },
  });
  const send = new FakeElement({
    tag: "button",
    text: "发送",
    className: "ant-im-btn ant-im-btn-primary im-ui-basic-send-btn ant-im-teno-btn",
    onClick: () => {
      transcript.innerText = `${transcript.innerText} ${textarea.value}`;
      transcript.textContent = transcript.innerText;
    },
  });
  const root = new FakeElement({ className: "im-ui-chat-container" }).append(
    transcript,
    new FakeElement({ className: "chatwin-action" }).append(resume, wechat),
    new FakeElement({ className: "im-ui-input-content" }).append(textarea),
    new FakeElement({ className: "im-ui-input-actions" }).append(send),
  );
  body.append(root);

  const result = await runBrowserExpression(contactFollowupExpression("liepin", {
    messages: ["您好，我这边目前在职，到岗时间可以沟通。"],
    stepDelayMs: 0,
    verifyDelayMs: 0,
  }), body);

  const resumeAction = result.actions.find((action) => action.type === "resume");
  const wechatAction = result.actions.find((action) => action.type === "wechat");

  assert.equal(result.verified, true);
  assert.equal(resumeAction.satisfiedBySignal, true);
  assert.equal(wechatAction.satisfiedBySignal, true);
  assert.deepEqual(wechatAction.confirmations.map((item) => item.text), ["确定"]);
  assert.ok(result.trace.some((step) => step.step === "exchange.confirmation.clicked" && step.type === "wechat" && step.text === "确定"));
});

test("contact follow-up treats pending WeChat request as already satisfied", async () => {
  const transcript = new FakeElement({
    className: "im-ui-message-list-wrapper",
    text: `${DEFAULT_CONTACT_FOLLOWUP_RESUME_NOTE} 您好，我这边目前在职，到岗时间可以沟通。`,
  });
  const textarea = new FakeElement({
    tag: "textarea",
    className: "ant-im-input ant-im-input-borderless im-ui-textarea",
    attrs: { placeholder: "请输入文字，按Enter键发送" },
  });
  const resume = new FakeElement({ tag: "span", text: "已发送简历", className: "im-ui-action-button action-item action-resume im-ui-action-button-disabled" });
  const wechat = new FakeElement({ tag: "span", text: "索要中", className: "im-ui-action-button action-item action-wechat im-ui-action-button-disabled" });
  const send = new FakeElement({ tag: "button", text: "发送", className: "ant-im-btn ant-im-btn-primary im-ui-basic-send-btn ant-im-teno-btn" });
  const root = new FakeElement({ className: "im-ui-chat-container" }).append(
    transcript,
    new FakeElement({ className: "chatwin-action" }).append(resume, wechat),
    new FakeElement({ className: "im-ui-input-content" }).append(textarea),
    new FakeElement({ className: "im-ui-input-actions" }).append(send),
  );
  const body = new FakeElement({ tag: "body" }).append(root);

  const result = await runBrowserExpression(contactFollowupExpression("liepin", {
    messages: ["您好，我这边目前在职，到岗时间可以沟通。"],
    stepDelayMs: 0,
    verifyDelayMs: 0,
  }), body);

  const wechatAction = result.actions.find((action) => action.type === "wechat");

  assert.equal(result.verified, true);
  assert.equal(wechatAction.status, "already-satisfied");
  assert.equal(wechatAction.clicked, false);
  assert.equal(wechat.clicked, 0);
  assert.ok(result.trace.some((step) => step.step === "exchange.already_satisfied" && step.type === "wechat"));
});

test("contact follow-up skips sending when the active BOSS chat already rejected the fit", async () => {
  const transcript = new FakeElement({
    className: "message-content",
    text: "\u4e0d\u597d\u610f\u601d\uff0c\u4e0d\u5408\u9002\u54e6",
  });
  const textarea = new FakeElement({
    tag: "textarea",
    className: "chat-input",
    attrs: { placeholder: "\u8f93\u5165\u6d88\u606f" },
  });
  const resume = new FakeElement({ tag: "span", text: "\u53d1\u7b80\u5386", className: "toolbar-btn action-resume" });
  const wechat = new FakeElement({ tag: "span", text: "\u6362\u5fae\u4fe1", className: "toolbar-btn action-wechat" });
  const send = new FakeElement({ tag: "button", text: "\u53d1\u9001", className: "btn-send" });
  const root = new FakeElement({ className: "chat-conversation" }).append(
    new FakeElement({ className: "chat-position-content", text: "AI Agent\u5de5\u7a0b\u5e08" }),
    transcript,
    new FakeElement({ className: "chat-controls" }).append(resume, wechat),
    new FakeElement({ className: "chat-input-wrap" }).append(textarea),
    new FakeElement({ className: "chat-op" }).append(send),
  );
  const body = new FakeElement({ tag: "body" }).append(root);

  const result = await runBrowserExpression(contactFollowupExpression("boss", {
    messagesNormalized: ["\u8fd9\u662f\u4e00\u6761\u4e0d\u5e94\u8be5\u53d1\u9001\u7684\u6d88\u606f"],
    stepDelayMs: 0,
    verifyDelayMs: 0,
  }), body, {
    url: "https://www.zhipin.com/web/geek/chat",
    title: "BOSS\u76f4\u8058",
  });

  assert.equal(result.verified, true);
  assert.equal(result.status, "followup-skipped-rejected");
  assert.equal(result.skipped, true);
  assert.equal(result.sentMessageCount, 0);
  assert.equal(resume.clicked, 0);
  assert.equal(wechat.clicked, 0);
});

test("contact follow-up ignores rejected BOSS text from the left conversation list", async () => {
  const sidebar = new FakeElement({
    className: "chat-user",
    text: "\u738b\u5973\u58eb \u4e0d\u597d\u610f\u601d\uff0c\u4e0d\u5408\u9002\u54e6",
  });
  const textarea = new FakeElement({
    tag: "textarea",
    className: "chat-input",
    attrs: { placeholder: "\u8f93\u5165\u6d88\u606f" },
  });
  const send = new FakeElement({ tag: "button", text: "\u53d1\u9001", className: "btn-send" });
  const active = new FakeElement({ className: "chat-conversation" }).append(
    new FakeElement({ className: "chat-position-content", text: "AI Agent\u5de5\u7a0b\u5e08" }),
    new FakeElement({ className: "message-content", text: "\u4f60\u597d\uff0c\u6211\u60f3\u5e94\u8058\u8d35\u516c\u53f8\u7684AI Agent\u5de5\u7a0b\u5e08" }),
    new FakeElement({ className: "chat-input-wrap" }).append(textarea),
    new FakeElement({ className: "chat-op" }).append(send),
  );
  const body = new FakeElement({ tag: "body" }).append(
    new FakeElement({ className: "chat-container" }).append(sidebar, active),
  );

  const result = await runBrowserExpression(contactFollowupExpression("boss", {
    messagesNormalized: ["\u8fd9\u662f\u4e00\u6761\u5e94\u8be5\u53d1\u9001\u7684\u6d88\u606f"],
    exchangeResume: false,
    exchangeWechat: false,
    requireExchangeActions: false,
    stepDelayMs: 0,
    verifyDelayMs: 0,
  }), body, {
    url: "https://www.zhipin.com/web/geek/chat",
    title: "BOSS\u76f4\u8058",
  });

  assert.equal(result.status, "followup-sent");
  assert.equal(result.skipped || false, false);
  assert.equal(result.sentMessageCount, 1);
  assert.equal(send.clicked, 1);
});

test("contact follow-up ignores already-satisfied BOSS text from the left conversation list", async () => {
  const sidebar = new FakeElement({
    className: "chat-user",
    text: "\u5bf9\u65b9\u5df2\u540c\u610f\uff0c\u60a8\u7684\u9644\u4ef6\u7b80\u5386\u5df2\u53d1\u9001\u7ed9\u5bf9\u65b9 \u5b59\u5973\u58eb\u7684\u5fae\u4fe1\u53f7\uff1awx_fixture_123",
  });
  const resume = new FakeElement({ tag: "button", text: "\u53d1\u7b80\u5386", className: "toolbar-btn action-resume" });
  const wechat = new FakeElement({ tag: "button", text: "\u6362\u5fae\u4fe1", className: "toolbar-btn action-wechat btn-weixin" });
  const textarea = new FakeElement({
    tag: "textarea",
    className: "chat-input",
    attrs: { placeholder: "\u8f93\u5165\u6d88\u606f" },
  });
  const active = new FakeElement({ className: "chat-conversation" }).append(
    new FakeElement({ className: "message-content", text: "\u4f60\u597d\uff0c\u6211\u60f3\u5e94\u8058\u8d35\u516c\u53f8\u7684AI Agent\u5de5\u7a0b\u5e08" }),
    new FakeElement({ className: "chat-controls" }).append(resume, wechat),
    new FakeElement({ className: "chat-input-wrap" }).append(textarea),
  );
  const body = new FakeElement({ tag: "body" }).append(
    new FakeElement({ className: "chat-container" }).append(sidebar, active),
  );

  const result = await runBrowserExpression(contactFollowupExpression("boss", {
    messagesNormalized: [],
    stepDelayMs: 0,
    verifyDelayMs: 0,
  }), body, {
    url: "https://www.zhipin.com/web/geek/chat",
    title: "BOSS\u76f4\u8058",
  });

  assert.equal(result.status, "followup-sent");
  assert.equal(result.clickedExchangeCount, 2);
  assert.equal(result.alreadySatisfiedExchangeCount, 0);
  assert.equal(resume.clicked, 1);
  assert.equal(wechat.clicked, 1);
});

test("contact follow-up prefers BOSS toolbar exchange buttons over chat transcript text", async () => {
  const transcript = new FakeElement({ className: "message-content", text: "\u8fd9\u662f\u6211\u7684\u7b80\u5386\uff0c\u8bf7\u67e5\u6536\uff0c\u5982\u679c\u65b9\u4fbf\u8f9b\u82e6\u60a8\u52a0\u6211\u5fae\u4fe1\u3002" });
  const resume = new FakeElement({ tag: "button", text: "\u53d1\u9001\u9644\u4ef6\u7b80\u5386", className: "toolbar-btn" });
  const wechat = new FakeElement({ tag: "button", text: "\u6362\u5fae\u4fe1", className: "btn-weixin toolbar-btn tooltip tooltip-top" });
  const textarea = new FakeElement({
    tag: "textarea",
    className: "chat-input",
    attrs: { placeholder: "\u8f93\u5165\u6d88\u606f" },
  });
  const active = new FakeElement({ className: "chat-conversation" }).append(
    transcript,
    new FakeElement({ className: "chat-controls" }).append(resume, wechat),
    new FakeElement({ className: "chat-input-wrap" }).append(textarea),
  );
  const body = new FakeElement({ tag: "body" }).append(
    new FakeElement({ className: "chat-container" }).append(active),
  );

  const result = await runBrowserExpression(contactFollowupExpression("boss", {
    messagesNormalized: [],
    stepDelayMs: 0,
    verifyDelayMs: 0,
  }), body, {
    url: "https://www.zhipin.com/web/geek/chat",
    title: "BOSS\u76f4\u8058",
  });

  assert.equal(result.clickedExchangeCount, 2);
  assert.equal(resume.clicked, 1);
  assert.equal(wechat.clicked, 1);
  assert.equal(transcript.clicked, 0);
});

test("contact follow-up records BOSS exchange buttons blocked until both sides reply", async () => {
  const resumeShell = new FakeElement({ className: "toolbar-btn tooltip tooltip-top unable", text: "\u53d1\u7b80\u5386 \u6c42\u7b80\u5386\uff1a\u53cc\u65b9\u56de\u590d\u540e\u53ef\u7528" }).append(
    new FakeElement({ tag: "span", text: "\u53d1\u7b80\u5386", className: "toolbar-btn-content" }),
  );
  const wechatShell = new FakeElement({ className: "btn-weixin toolbar-btn tooltip tooltip-top unable", text: "\u6362\u5fae\u4fe1 \u4ea4\u6362\u5fae\u4fe1\uff1a\u53cc\u65b9\u56de\u590d\u540e\u53ef\u7528" }).append(
    new FakeElement({ tag: "span", text: "\u6362\u5fae\u4fe1", className: "toolbar-btn-content" }),
  );
  const textarea = new FakeElement({
    tag: "textarea",
    className: "chat-input",
    attrs: { placeholder: "\u8f93\u5165\u6d88\u606f" },
  });
  const active = new FakeElement({ className: "chat-conversation" }).append(
    new FakeElement({ className: "message-content", text: "\u4f60\u597d\uff0c\u6211\u60f3\u5e94\u8058\u8d35\u516c\u53f8\u7684AI Agent\u5de5\u7a0b\u5e08" }),
    new FakeElement({ className: "chat-controls" }).append(resumeShell, wechatShell),
    new FakeElement({ className: "chat-input-wrap" }).append(textarea),
  );
  const body = new FakeElement({ tag: "body" }).append(active);

  const result = await runBrowserExpression(contactFollowupExpression("boss", {
    messagesNormalized: [],
    stepDelayMs: 0,
    verifyDelayMs: 0,
  }), body, {
    url: "https://www.zhipin.com/web/geek/chat",
    title: "BOSS\u76f4\u8058",
  });

  assert.equal(result.verified, false);
  assert.equal(result.status, "exchange-action-not-satisfied");
  assert.equal(result.unavailableExchangeCount, 2);
  assert.equal(result.clickedExchangeCount, 0);
  assert.ok(result.actions.every((action) => action.satisfied === false));
  assert.ok(result.actions.every((action) => action.status === "platform-unavailable"));
  assert.ok(result.trace.some((step) => step.step === "exchange.action.unavailable" && step.type === "wechat"));
});

test("contact follow-up message normalization keeps resume note and splits long content", () => {
  const long = `第一段${"a".repeat(180)}\n\n第二段${"b".repeat(180)}`;
  const chunks = splitContactFollowupMessage(long, 120);
  const messages = normalizeContactFollowupMessages({
    resumeNote: DEFAULT_CONTACT_FOLLOWUP_RESUME_NOTE,
    messages: [long],
    maxChars: 120,
  });

  assert.ok(chunks.length > 2);
  assert.equal(messages[0], DEFAULT_CONTACT_FOLLOWUP_RESUME_NOTE);
  assert.ok(messages.every((item) => item.length <= 120 || item === DEFAULT_CONTACT_FOLLOWUP_RESUME_NOTE));
});

test("contact action runner opens an existing conversation before follow-up instead of closing immediately", async () => {
  const target = {
    id: "liepin-detail",
    type: "page",
    url: "https://www.liepin.com/lptjob/123",
    webSocketDebuggerUrl: "ws://example",
  };
  const evaluated = [];
  const closed = [];
  const runner = createContactActionRunner({
    listTargets: async () => [target],
    evaluateTarget: async (_target, expression) => {
      evaluated.push(expression);
      if (String(expression).includes("__JOB_BOARD_CONTACT_PAGE_STATE__")) {
        return {
          supported: true,
          alreadySatisfied: true,
          alreadyContacted: true,
          conversationOpen: false,
          messageSent: false,
          status: "existing-conversation-marker",
        };
      }
      if (String(expression).includes("__JOB_BOARD_CONTACT_FOLLOWUP__")) {
        return {
          supported: true,
          attempted: true,
          verified: true,
          status: "followup-sent",
          sentMessageCount: 2,
          clickedExchangeCount: 2,
        };
      }
      if (String(expression).includes("聊一聊") || String(expression).includes("\\u804a\\u4e00\\u804a")) {
        return { supported: true, attempted: true, clicked: true, label: "继续聊", targetText: "继续聊" };
      }
      return {
        supported: true,
        verified: true,
        status: "conversation-opened",
        alreadyContacted: true,
        conversationOpen: true,
        messageSent: false,
      };
    },
    closeTarget: async (port, targetId, reason) => {
      closed.push({ port, targetId, reason });
      return { closed: true, targetId, reason };
    },
    delay: async () => {},
  });

  const [action] = await runner.triggerContactActions(9222, [
    { id: "liepin-ai", site: "liepin", url: target.url, targetId: target.id },
  ], {
    enabled: true,
    delayMs: 0,
    verifyDelayMs: 0,
    retryDelayMs: 0,
    maxAttempts: 1,
    betweenRecordsDelayMs: 0,
    followup: {
      enabled: true,
      messages: ["您好，方便进一步沟通。"],
      stepDelayMs: 0,
      verifyDelayMs: 0,
    },
  });

  assert.equal(action.verified, true);
  assert.equal(action.followup.verified, true);
  assert.equal(action.followup.messagePlan.normalizedCount, 2);
  assert.equal(action.followup.messagePlan.messages[0].length, DEFAULT_CONTACT_FOLLOWUP_RESUME_NOTE.length);
  assert.equal(JSON.stringify(action.followup.messagePlan).includes("方便进一步沟通"), false);
  assert.equal(action.attemptCount, 1);
  assert.equal(action.clicked, true);
  assert.deepEqual(closed, [{ port: 9222, targetId: "liepin-detail", reason: "contact-followup-verified" }]);
  assert.equal(evaluated.filter((expression) => String(expression).includes("__JOB_BOARD_CONTACT_FOLLOWUP__")).length, 1);
});

test("contact action runner recheck mode does not start a new conversation", async () => {
  const target = {
    id: "boss-detail",
    type: "page",
    url: "https://www.zhipin.com/job_detail/123.html",
    webSocketDebuggerUrl: "ws://example",
  };
  const evaluated = [];
  const runner = createContactActionRunner({
    listTargets: async () => [target],
    evaluateTarget: async (_target, expression) => {
      evaluated.push(String(expression));
      if (String(expression).includes("__JOB_BOARD_CONTACT_PAGE_STATE__")) {
        return {
          supported: true,
          alreadySatisfied: false,
          alreadyContacted: false,
          conversationOpen: false,
          messageSent: false,
          status: "not-contacted",
        };
      }
      throw new Error("recheck must not click a new contact trigger");
    },
    delay: async () => {},
  });

  const [action] = await runner.triggerContactActions(9222, [
    { id: "boss-ai", site: "boss", url: target.url, targetId: target.id },
  ], {
    enabled: true,
    delayMs: 0,
    verifyDelayMs: 0,
    retryDelayMs: 0,
    maxAttempts: 1,
    betweenRecordsDelayMs: 0,
    followup: {
      enabled: true,
      requireExistingConversationOnly: true,
      messages: [],
      messagesNormalized: [],
      stepDelayMs: 0,
      verifyDelayMs: 0,
    },
  });

  assert.equal(action.attempted, false);
  assert.equal(action.clicked, false);
  assert.equal(action.verified, false);
  assert.equal(action.followup.status, "existing-conversation-not-found-before-recheck");
  assert.equal(evaluated.length, 1);
});
