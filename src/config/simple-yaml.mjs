function stripComment(line) {
  let quoted = false;
  let quote = "";
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if ((ch === "\"" || ch === "'") && line[i - 1] !== "\\") {
      if (!quoted) {
        quoted = true;
        quote = ch;
      } else if (quote === ch) {
        quoted = false;
      }
    }
    if (ch === "#" && !quoted) return line.slice(0, i);
  }
  return line;
}

function parseScalar(value) {
  const raw = String(value || "").trim();
  if (raw === "") return "";
  if (raw === "null" || raw === "~") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  if ((raw.startsWith("\"") && raw.endsWith("\"")) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const body = raw.slice(1, -1).trim();
    if (!body) return [];
    return body.split(",").map((part) => parseScalar(part.trim()));
  }
  return raw;
}

function parseKeyValue(text) {
  const match = String(text).match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
  if (!match) return null;
  return { key: match[1], value: match[2] === undefined ? "" : match[2] };
}

export function parseSimpleYaml(text) {
  const root = {};
  let currentTop = null;
  let currentItem = null;
  let currentNestedKey = null;

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const withoutComment = stripComment(rawLine).replace(/\s+$/, "");
    if (!withoutComment.trim()) continue;
    const indent = withoutComment.match(/^ */)[0].length;
    const line = withoutComment.trim();

    if (indent === 0) {
      const pair = parseKeyValue(line);
      if (!pair) throw new Error(`Unsupported YAML line: ${rawLine}`);
      currentTop = pair.key;
      currentItem = null;
      currentNestedKey = null;
      root[pair.key] = pair.value === "" ? {} : parseScalar(pair.value);
      continue;
    }

    if (!currentTop) throw new Error(`Nested YAML without a parent key: ${rawLine}`);

    if (indent === 2 && line.startsWith("- ")) {
      if (!Array.isArray(root[currentTop])) root[currentTop] = [];
      const rest = line.slice(2).trim();
      const pair = parseKeyValue(rest);
      if (pair) {
        currentItem = { [pair.key]: parseScalar(pair.value) };
        root[currentTop].push(currentItem);
      } else {
        currentItem = null;
        root[currentTop].push(parseScalar(rest));
      }
      currentNestedKey = null;
      continue;
    }

    if (indent === 4 && currentItem) {
      const pair = parseKeyValue(line);
      if (!pair) throw new Error(`Unsupported YAML list item line: ${rawLine}`);
      currentItem[pair.key] = parseScalar(pair.value);
      continue;
    }

    if (indent === 2) {
      if (typeof root[currentTop] !== "object" || Array.isArray(root[currentTop]) || root[currentTop] === null) {
        root[currentTop] = {};
      }
      const pair = parseKeyValue(line);
      if (!pair) throw new Error(`Unsupported YAML map line: ${rawLine}`);
      root[currentTop][pair.key] = pair.value === "" ? [] : parseScalar(pair.value);
      currentNestedKey = pair.value === "" ? pair.key : null;
      currentItem = null;
      continue;
    }

    if (indent === 4 && currentNestedKey && line.startsWith("- ")) {
      const target = root[currentTop][currentNestedKey];
      if (!Array.isArray(target)) throw new Error(`Nested YAML key is not a list: ${currentNestedKey}`);
      target.push(parseScalar(line.slice(2).trim()));
      continue;
    }

    throw new Error(`Unsupported YAML indentation: ${rawLine}`);
  }

  return root;
}
