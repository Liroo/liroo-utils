const fs = require("fs");
const path = require("path");

const source = path.resolve(__dirname, "../../wlogs");
const rootNM = path.resolve(__dirname, "../../../node_modules/@liroo/wlogs");
const localNM = path.resolve(__dirname, "../node_modules/@liroo/wlogs");

console.log("[link-wlogs] source:", source);
console.log("[link-wlogs] source exists:", fs.existsSync(source));
console.log("[link-wlogs] source dist/index.js:", fs.existsSync(path.join(source, "dist/index.js")));
console.log("[link-wlogs] root node_modules:", rootNM, "exists:", fs.existsSync(rootNM));
console.log("[link-wlogs] local node_modules:", localNM, "exists:", fs.existsSync(localNM));

// Check if already resolvable
try {
  const resolved = require.resolve("@liroo/wlogs");
  console.log("[link-wlogs] require.resolve OK:", resolved);
  process.exit(0);
} catch {
  console.log("[link-wlogs] require.resolve failed, will copy");
}

// Copy wlogs into local node_modules
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "src" || entry.name === ".git") continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

fs.mkdirSync(path.dirname(localNM), { recursive: true });
copyDir(source, localNM);
console.log("[link-wlogs] Copied. dist/index.js exists:", fs.existsSync(path.join(localNM, "dist/index.js")));
