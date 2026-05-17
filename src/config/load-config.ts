import fs from "node:fs";
import YAML from "yaml";

export function loadYamlFile(file: string): unknown {
  return YAML.parse(fs.readFileSync(file, "utf8"));
}
