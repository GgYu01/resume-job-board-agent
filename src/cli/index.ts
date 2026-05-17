export { main } from "./main.js";

import { main } from "./main.js";

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
