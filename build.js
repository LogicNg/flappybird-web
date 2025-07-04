const fs = require("fs-extra");
const path = require("path");
const { minify: minifyHTML } = require("html-minifier-terser");
const { minify: minifyJS } = require("terser");
const CleanCSS = require("clean-css");
const JavaScriptObfuscator = require("javascript-obfuscator");

const srcDir = __dirname;
const distDir = path.join(__dirname, "dist");

async function build() {
  console.log("Starting build process...");

  // Clean and create dist directory
  await fs.remove(distDir);
  await fs.ensureDir(distDir);

  // Copy assets directory
  console.log("Copying assets...");
  await fs.copy(
    path.join(srcDir, "src", "assets"),
    path.join(distDir, "assets")
  );

  // Minify CSS
  console.log("Minifying CSS...");
  const cssContent = await fs.readFile(
    path.join(srcDir, "src", "style.css"),
    "utf8"
  );
  const cleanCSS = new CleanCSS({
    level: 2,
    format: "beautify",
  });
  const minifiedCSS = cleanCSS.minify(cssContent);

  if (minifiedCSS.errors.length > 0) {
    console.error("CSS minification errors:", minifiedCSS.errors);
  }

  await fs.writeFile(path.join(distDir, "style.css"), minifiedCSS.styles);
  console.log("CSS minified successfully");

  // Minify JavaScript and remove console.log
  console.log("Minifying JavaScript...");
  const jsContent = await fs.readFile(
    path.join(srcDir, "src", "game.js"),
    "utf8"
  );

  const minifiedJS = await minifyJS(jsContent, {
    compress: {
      drop_console: true, // This removes all console.* calls
      drop_debugger: true,
      pure_funcs: [
        "console.log",
        "console.info",
        "console.debug",
        "console.warn",
      ],
    },
    mangle: true,
    format: {
      comments: false,
    },
  });

  if (minifiedJS.error) {
    console.error("JavaScript minification error:", minifiedJS.error);
    throw minifiedJS.error;
  }

  // Obfuscate the minified JavaScript
  console.log("Obfuscating JavaScript...");
  const obfuscationResult = JavaScriptObfuscator.obfuscate(minifiedJS.code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false,
    debugProtectionInterval: 0,
    disableConsoleOutput: true,
    identifierNamesGenerator: "hexadecimal",
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ["base64"],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: "function",
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
  });

  await fs.writeFile(
    path.join(distDir, "game.js"),
    obfuscationResult.getObfuscatedCode()
  );
  console.log("JavaScript minified and obfuscated successfully");

  // Minify HTML
  console.log("Minifying HTML...");
  const htmlContent = await fs.readFile(
    path.join(srcDir, "src", "index.html"),
    "utf8"
  );

  const minifiedHTML = await minifyHTML(htmlContent, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    minifyCSS: true,
    minifyJS: true,
  });

  await fs.writeFile(path.join(distDir, "index.html"), minifiedHTML);
  console.log("HTML minified successfully");

  // Copy other necessary files
  console.log("Copying additional files...");
  if (await fs.pathExists(path.join(srcDir, "README.md"))) {
    await fs.copy(
      path.join(srcDir, "README.md"),
      path.join(distDir, "README.md")
    );
  }

  console.log("Build completed successfully!");
  console.log(`Files built to: ${distDir}`);
}

build().catch(console.error);
