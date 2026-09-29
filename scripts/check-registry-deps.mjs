import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const rootDir = process.cwd();
const registryDir = join(rootDir, "registry", "default");
const packageJsonPath = join(rootDir, "package.json");
const registryManifestPath = join(rootDir, "registry.json");
const typesetStylesheetPath = join(rootDir, "src", "components", "ui", "typeset.css");
const editorComponentPaths = [
  join(rootDir, "src", "components", "ui", "editor.tsx"),
  join(rootDir, "registry", "default", "editor", "editor.tsx"),
];

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const declared = new Set(Object.keys(packageJson.dependencies ?? {}));
const registryManifest = JSON.parse(readFileSync(registryManifestPath, "utf8"));
const registryItem = (registryManifest.items ?? []).find((item) => item.name === "editor");
const registryDeclared = new Set(registryItem?.dependencies ?? []);
const IGNORED_PACKAGES = new Set(["react", "react-dom"]);

const sourceFiles = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const ext = extname(fullPath);
    if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx") {
      sourceFiles.push(fullPath);
    }
  }
};

const toPackageName = (specifier) => {
  if (specifier.startsWith("@")) {
    const versionAt = specifier.lastIndexOf("@");
    const packageSpecifier =
      versionAt > specifier.indexOf("/") ? specifier.slice(0, versionAt) : specifier;
    const parts = packageSpecifier.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split("@")[0].split("/")[0];
};

const registryDeclaredPackages = new Set(Array.from(registryDeclared, toPackageName));

const isPackageImport = (specifier) =>
  !!specifier &&
  !specifier.startsWith(".") &&
  !specifier.startsWith("/") &&
  !specifier.startsWith("@/");

const readImports = (source) => {
  const matches = [];
  const fromRegex = /\bfrom\s+["']([^"']+)["']/g;
  const importRegex = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  let match;

  while ((match = fromRegex.exec(source)) !== null) {
    matches.push(match[1]);
  }
  while ((match = importRegex.exec(source)) !== null) {
    matches.push(match[1]);
  }
  return matches;
};

walk(registryDir);

const missingInPackage = new Map();
const missingInRegistryManifest = new Map();
for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  for (const specifier of readImports(source)) {
    if (!isPackageImport(specifier)) continue;
    const packageName = toPackageName(specifier);
    if (IGNORED_PACKAGES.has(packageName)) continue;
    if (!declared.has(packageName)) {
      if (!missingInPackage.has(packageName)) missingInPackage.set(packageName, new Set());
      missingInPackage.get(packageName).add(specifier);
    }
    if (!registryDeclaredPackages.has(packageName)) {
      if (!missingInRegistryManifest.has(packageName)) {
        missingInRegistryManifest.set(packageName, new Set());
      }
      missingInRegistryManifest.get(packageName).add(specifier);
    }
  }
}

if (missingInPackage.size > 0 || missingInRegistryManifest.size > 0) {
  console.error("Registry dependency check failed.");
  if (missingInPackage.size > 0) {
    console.error("Missing from package.json dependencies:");
    for (const [pkg, specifiers] of missingInPackage.entries()) {
      const used = Array.from(specifiers).sort().join(", ");
      console.error(`- ${pkg} (imports: ${used})`);
    }
  }
  if (missingInRegistryManifest.size > 0) {
    console.error("Missing from registry.json item dependencies:");
    for (const [pkg, specifiers] of missingInRegistryManifest.entries()) {
      const used = Array.from(specifiers).sort().join(", ");
      console.error(`- ${pkg} (imports: ${used})`);
    }
  }
  process.exit(1);
}

if (!registryItem) {
  console.error('Registry dependency check failed. Missing "editor" item in registry.json.');
  process.exit(1);
}

for (const dependency of registryDeclared) {
  const pkg = toPackageName(dependency);
  if (!declared.has(pkg)) {
    console.error(`Registry dependency check failed. "${pkg}" is in registry.json but missing from package.json dependencies.`);
    process.exit(1);
  }
}

const typesetStylesheet = readFileSync(typesetStylesheetPath, "utf8");
const expectedLayerOrder = "@layer theme, base, components, utilities;";

if (!typesetStylesheet.includes(expectedLayerOrder)) {
  console.error(
    `Registry dependency check failed. typeset.css must declare \"${expectedLayerOrder}\" before its component rules so Tailwind's base reset does not override them.`,
  );
  process.exit(1);
}

if (/\{[^{}]*&(?:\s|:|\[|\.)/s.test(typesetStylesheet)) {
  console.error(
    "Registry dependency check failed. typeset.css contains nested selectors; registry consumers must receive flattened CSS.",
  );
  process.exit(1);
}

for (const editorComponentPath of editorComponentPaths) {
  const editorComponent = readFileSync(editorComponentPath, "utf8");
  if (/handleDOMEvents\s*:\s*\{[\s\S]*?\bcopy\s*:/.test(editorComponent)) {
    console.error(
      "Registry dependency check failed. The editor must use ProseMirror's native clipboard serializer so copy provides structural HTML and marker-free plain text.",
    );
    process.exit(1);
  }
}

console.log("Registry dependency check passed.");
