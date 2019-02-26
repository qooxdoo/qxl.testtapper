const fs = require("fs");
const puppeteer = require("puppeteer");

let argv = require("yargs")
  .command("$0 [options] <url>", "run a tests with TAP compliant reporting", yargs => {
    yargs.positional("url", {
      describe: "URL to access for testing",
      type: "string",
      example: "https://localhost:8888/runTests"
    })
      .options({
        verbose: {
          describe: "show all console messages",
          type: "boolean"
        },
        diag: {
          describe: "show diagnostic output",
          type: "boolean"
        },
        terse: {
          describe: "show only summary and errors",
          type: "boolean"
        },
        module: {
          describe: "only run tests of this module",
          type: "string"
        }
      });
  })
  .help("h")
  .alias("h", "help")
  .version("0.0.1")
  .wrap(72)
  .strict(true)
  .argv;

let href = argv.url;
if (fs.existsSync(href)) {
  if (href.match(/^[^/]/)) {
    href = process.cwd() + "/" + href;
  }
  href = "file://" + href;
}
href = new URL(href);

if (argv.module) {
  href.hash = "module=" + argv.module;
}

console.log("CALL "+ href.href);

let notOk = 0;
let Ok = 0;
try {
  (async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on("console", async msg => {
      const args = await msg.args;
      if (args && args.map) {
        Promise.all(args.map(async arg => {
          const val = await arg.jsonValue();
          // value is serializable
          // eslint-disable-next-line no-negated-condition
          if (val.match && JSON.stringify(val) !== JSON.stringify({})) {
            if  ( val.match(/^\d+\.\.\d+$/)) {
              browser.close();
              console.info(`DONE testing ${Ok} ok, ${notOk} not ok`);
              if (notOk > 0) {
                process.exitCode = 1;
              }
            }
            if (val.match(/^not ok /)) {
              notOk++;
              console.log(val);
            } else if (val.match(/^ok\s/)) {
              if (!argv.terse) {
                console.log(val);
              }
              Ok++;
            } else if (val.match(/^#/) && argv.diag) {
              console.log(val);
            } else if (val.verbose) {
              console.log(val);
            }
          } else {
            const {
              type, subtype, description
            } = arg._remoteObject;
            if (val.diag || val.verbose) {
              console.log(description);
            }
          }
        })).catch(err => {
          throw (err);
        });
      }
    });
    await page.goto(href.href);
  })();
} catch (err) {
  console.log(err);
}
