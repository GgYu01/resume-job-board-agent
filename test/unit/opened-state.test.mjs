import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  alreadyOpened,
  appendOpenedState,
  dedupeOpenRecords,
  loadOpenedState,
  recordIdentityKeys,
} from "../../src/state/opened-state.mjs";

test("opened state stores semantic job signatures for repeat prevention", () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "job-opened-state-"));
  const first = {
    site: "boss",
    title: "AI Agent 工程师",
    company: "Future AI",
    location: "深圳",
    url: "https://www.zhipin.com/job_detail/first.html",
  };
  const duplicate = {
    site: "boss",
    titleText: "AI Agent 工程师",
    company: "Future AI",
    city: "深圳",
    url: "https://www.zhipin.com/job_detail/second.html",
  };

  appendOpenedState(stateDir, [first]);
  const state = loadOpenedState(stateDir);

  assert.equal(alreadyOpened(duplicate, state), true);
  assert(recordIdentityKeys(first).some((key) => key.startsWith("sig:")));
});

test("dedupeOpenRecords reports same-position duplicates before opening", () => {
  const records = [
    {
      site: "liepin",
      title: "云原生 SRE 工程师",
      company: "Cloud Co",
      location: "上海",
      url: "https://www.liepin.com/job/1981404985.shtml",
    },
    {
      site: "liepin",
      title: "云原生 SRE 工程师",
      company: "Cloud Co",
      city: "上海",
      url: "https://www.liepin.com/job/1981404999.shtml",
    },
  ];

  const { records: kept, rejected } = dedupeOpenRecords(records, loadOpenedState(fs.mkdtempSync(path.join(os.tmpdir(), "job-opened-state-"))));

  assert.equal(kept.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].skipReason, "duplicate-job-signature");
});

test("semantic duplicate still matches when one record lacks location", () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "job-opened-state-"));
  appendOpenedState(stateDir, [
    {
      site: "boss",
      title: "后端开发工程师",
      company: "Stable Co",
      location: "北京",
      url: "https://www.zhipin.com/job_detail/backend_a.html",
    },
  ]);

  assert.equal(alreadyOpened({
    site: "liepin",
    title: "后端开发工程师",
    company: "Stable Co",
    url: "https://www.liepin.com/job/1981405000.shtml",
  }, loadOpenedState(stateDir)), true);
});

test("loadOpenedState backfills semantic keys from historical opened receipts", () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "job-opened-state-"));
  fs.writeFileSync(
    path.join(stateDir, "opened_legacy.json"),
    `${JSON.stringify({
      opened: [
        {
          site: "boss",
          title: "嵌入式 Linux 工程师",
          company: "Device Co",
          location: "苏州",
          url: "https://www.zhipin.com/job_detail/embedded_a.html",
        },
      ],
    })}\n`,
    "utf8",
  );

  const state = loadOpenedState(stateDir);

  assert.equal(alreadyOpened({
    site: "liepin",
    title: "嵌入式 Linux 工程师",
    company: "Device Co",
    url: "https://www.liepin.com/job/1981406000.shtml",
  }, state), true);
});

test("recordIdentityKeys can infer company from card text when company field is missing", () => {
  const keys = recordIdentityKeys({
    site: "boss",
    titleText: "AI Agent 工程师",
    cardText: "AI Agent 工程师\n30-45K\n3-5年\n本科\nFuture AI\n深圳",
    url: "https://www.zhipin.com/job_detail/card_company.html",
  });

  assert(keys.includes("sig:ai agent 工程师|future ai"));
});
