import assert from "node:assert/strict";
import test from "node:test";

import { listSiteAdapters } from "../../src/sites/registry.mjs";

test("each site adapter owns URL, auth, collection, detail, access-limit, and contact contracts", () => {
  for (const adapter of listSiteAdapters()) {
    assert.equal(typeof adapter.id, "string", `${adapter.id}.id`);
    assert.equal(typeof adapter.canonicalize, "function", `${adapter.id}.canonicalize`);
    assert.equal(typeof adapter.searchUrl, "function", `${adapter.id}.searchUrl`);
    assert.equal(typeof adapter.authProbe, "function", `${adapter.id}.authProbe`);
    assert.equal(typeof adapter.collectExpression, "function", `${adapter.id}.collectExpression`);
    assert.equal(typeof adapter.detailExpression, "function", `${adapter.id}.detailExpression`);
    assert.equal(typeof adapter.accessLimitExpression, "function", `${adapter.id}.accessLimitExpression`);
    assert.equal(typeof adapter.contactActionSpec, "function", `${adapter.id}.contactActionSpec`);
  }
});
