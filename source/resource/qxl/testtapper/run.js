let fs = require("fs");
let puppeteer = require("puppeteer");

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
  .version("0.1.6")
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
puppeteer.launch().then(
  browser => {
    return browser.newPage().then(
      page => {
        page.on("console", msg => {
          let val = msg.text;
          // value is serializable
          // eslint-disable-next-line no-negated-condition
          if (val.match && JSON.stringify(val) !== JSON.stringify({})) {
            if  ( val.match(/^\d+\.\.\d+$/)) {
              browser.close();
              console.info(`DONE testing ${Ok} ok, ${notOk} not ok`);
              process.exit(notOk);
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
        });
        return page.goto(href.href);
      }
    );
  }
).catch( err => {
  console.log(`ERROR ${err}`);
  process.exit(1);
});
