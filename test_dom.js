const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");

const html = fs.readFileSync("public/dj_live.html", "utf-8");

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable"
});

dom.window.onerror = function(msg, source, lineno, colno, error) {
  console.log("BROWSER ERROR:", msg, "at line", lineno);
};

dom.window.console.error = function(...args) {
  console.log("CONSOLE ERROR:", ...args);
};

console.log("Loaded DOM.");

setTimeout(() => {
    console.log("Done waiting 2 seconds.");
    process.exit(0);
}, 2000);
