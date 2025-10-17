const { promisify } = require("util");
const fs = require("fs");
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const path = require("path");
const { URL } = require("url");
const { performance } = require("perf_hooks");

qx.Class.define("qxl.testtapper.compile.LibraryApi", {
  extend: qx.tool.compiler.cli.api.LibraryApi,

  members: {
    // @Override
    initialize(cmd) {
      if (cmd.getName() !== "test") {
        return;
      }
      cmd.addFlag(
        new qx.tool.cli.Flag("class").set({
          description: "only run tests of this class",
          type: "string"
        })
      );

      cmd.addFlag(
        new qx.tool.cli.Flag("method").set({
          description: "only run tests of this method",
          type: "string"
        })
      );

      cmd.addFlag(
        new qx.tool.cli.Flag("diag").set({
          description: "show diagnostic output",
          type: "boolean",
          value: false
        })
      );

      cmd.addFlag(
        new qx.tool.cli.Flag("terse").set({
          description: "show only summary and errors",
          type: "boolean",
          value: false
        })
      );

      cmd.addFlag(
        new qx.tool.cli.Flag("stackTrace").set({
          description: "prints the stacktrace in case of error",
          type: "boolean",
          value: false
        })
      );

      cmd.addFlag(
        new qx.tool.cli.Flag("coverage").set({
          description: "writes coverage infos, only working for chromium yet",
          type: "boolean",
          value: false
        })
      );

      cmd.addFlag(
        new qx.tool.cli.Flag("headless").set({
          description: "runs test headless",
          type: "boolean",
          value: false
        })
      );

      cmd.addFlag(
        new qx.tool.cli.Flag("browsers").set({
          description: "list of browsers to test against, currently supported chromium, firefox, webkit",
          type: "string",
          value: "chromium"
        })
      );
    },

    __enviroment: null,
    __playwright: null,
    __v8toIstanbul: null,

    // @Override
    async load() {
      let command = this.getCompilerApi().getCommand();
      if (command instanceof qx.tool.compiler.cli.commands.Test) {
        command.addListener("runTests", this.__testIt, this);
        if (command.setNeedsServer) {
          command.setNeedsServer(true);
        }
      }
    },

    __testIt(data) {
      let app = this.__getTestApp("qxl.testtapper.Application");
      if (!app) {
        qx.tool.compiler.Console.error(
          "Please install testtapper application in compile.json"
        );
        return qx.Promise.resolve(false);
      }
      let result = data.getData();
      return this.__runTests(app, result);
    },

    __runTestInBrowser(browserType, url, app, result) {
      return new qx.Promise(async (resolve, reject) => {
        try {
          if (!this.__playwright) {
            this.__playwright = this.require("playwright");
            const { execSync } = require("child_process");
            let s;
            s = `npx playwright install-deps`;
            qx.tool.compiler.Console.info(s);
            execSync(s, {
              stdio: "inherit"
            });
            s = `npx playwright install`;
            qx.tool.compiler.Console.info(s);
            execSync(s, {
              stdio: "inherit"
            });
          }
          if (!this.__v8toIstanbul) {	         
             this.__v8toIstanbul = this.require("v8-to-istanbul");
          }   
          console.log("TAP version 13");
          console.log(`# TESTTAPPER: Running tests in ${browserType}`);
          let args = [];
          if (browserType !== "webkit") {
            args.push("--no-sandbox");
            args.push("--disable-setuid-sandbox");  
          }
          const launchArgs = {
            args: args,
            headless:
              app.argv.headless === null
                ? app.environment["qxl.testtapper.headless"] === null
                  ? true
                  : app.environment["qxl.testtapper.headless"]
                : app.argv.headless,
          };
          if (app.argv.verbose) {
            console.log(launchArgs);
          }
          const browser = this.__playwright[browserType];
          if (!browser) {
            reject(new Error(`unknown browser ${browserType}`));
          }
          const context = await browser.launch(launchArgs);
          const page = await context.newPage();
          let cov =
            (app.argv.coverage === null
              ? app.environment["qxl.testtapper.coverage"] === null
                ? false
                : app.environment["qxl.testtapper.coverage"]
              : app.argv.coverage) && browserType === "chromium";
          if (cov) {
            await page.coverage.startJSCoverage();
          }
          let Ok = 0;
          let notOk = 0;
          let skipped = 0;
          let startTime;
          page.on("console", async (msg) => {
            let val = msg.text();
            // value is serializable
            if (val.match(/^\d+\.\.\d+$/)) {
              let endTime = performance.now();
              let timeDiff = endTime - startTime;
              qx.tool.compiler.Console.info(
                `DONE testing ${browserType}: ${Ok} ok, ${notOk} not ok, ${skipped} skipped - [${timeDiff.toFixed(
                  0
                )} ms]`
              );
              if (cov) {
                qx.tool.compiler.Console.info(
                  `${browserType}: writing coverage information ...`
                );
                const coverage = await page.coverage.stopJSCoverage();
                const entries = {};
                let target = app.maker.getTarget();
                let outputDir = target.getOutputDir();
                const sourceMapUrl = this.require("source-map-url");
                for await (entry of coverage) {
                  let source;
                  let sm = sourceMapUrl.getFrom(entry.source);
                  if (sm) {
                    sm = sm.split("?")[0];
                    source = sourceMapUrl.removeFrom(entry.source);
                    source += `//# sourceMappingURL=${sm}`;
                  } else {
                    source = entry.source;
                  }
                  let url = new URL(entry.url);
                  filePath = path.join(process.cwd(), outputDir, url.pathname);
                  const converter = new this.__v8toIstanbul(filePath, 0, {
                    source: source,
                  });

                  await converter.load();
                  converter.applyCoverage(entry.functions);
                  const instanbul = converter.toIstanbul();
                  entries[filePath] = instanbul[filePath];
                }
                await mkdir(path.join(process.cwd(), ".nyc_output"), {
                  recursive: true,
                });
                await writeFile(
                  path.join(process.cwd(), ".nyc_output", "out.json"),
                  JSON.stringify(entries)
                );
              }
              await context.close();
              result[app.name][browserType] = {
                notOk: notOk,
                ok: Ok,
              };
              resolve(notOk);
            } else if (val.match(/^not ok /)) {
              notOk++;
              qx.tool.compiler.Console.log(`${browserType}: ${val}`);
            } else if (val.includes("# SKIP")) {
              skipped++;
              if (!app.argv.terse) {
                qx.tool.compiler.Console.log(`${browserType}: ${val}`);
              }
            } else if (val.match(/^ok\s/)) {
              Ok++;
              if (!app.argv.terse) {
                qx.tool.compiler.Console.log(`${browserType}: ${val}`);
              }
            } else if (val.match(/^#/) && app.argv.diag) {
              qx.tool.compiler.Console.log(`${browserType}: ${val}`);
            } else if (app.argv.verbose) {
              qx.tool.compiler.Console.log(`${browserType}: ${val}`);
            }
          });
          startTime = performance.now();
          page.goto(url.href);
        } catch (e) {
          reject(e);
        }
      });
    },

    async __runTests(app, result) {
      let outputDir = "";
      let exitCode = 0;

      let href = `http://localhost:${app.listenPort}/${outputDir}${app.name}/`;
      let url = new URL(href);
      let s = `stackTrace=${app.argv.stackTrace}`;
      if (app.argv.method) {
        if (s.length > 0) {
          s += "&";
        }
        exitCode = 254;
        s += "method=" + app.argv.method;
      }
      if (app.argv.class) {
        if (s.length > 0) {
          s += "&";
        }
        exitCode = 254;
        s += "class=" + app.argv.class;
      }
      if (s.length > 0) {
        url.search = s;
      }
      qx.tool.compiler.Console.log("CALL " + url.href);
      result[app.name] = {};
      let browsers = (app.argv.browsers || "")
        .split(",")
        .filter((s) => s.length > 0);
      if (browsers.length === 0) {
        browsers = app.environment["qxl.testtapper.browsers"];
      }
      if (!browsers || browsers.length === 0) {
        browsers = ["chromium"];
      }
      let tests = [];
      for (const browserType of browsers) {
        try {
          tests.push(this.__runTestInBrowser(browserType, url, app, result));
        } catch (e) {
          qx.tool.compiler.Console.error(e);
          exitCode = 253;
        }
      }
      let res = await Promise.all(tests);
      let sum = res.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
      if (sum > 0) {
        exitCode = Math.min(sum, 252);
      }
      result.setExitCode(exitCode);
    },

    __getTestApp(classname) {
      let command = this.getCompilerApi().getCommand();
      let maker = null;
      let app = null;
      command.getMakers().forEach((tmp) => {
        let apps = tmp
          .getApplications()
          .filter(
            (app) => app.getClassName() === classname && app.isBrowserApp()
          );
        if (apps.length) {
          if (maker) {
            qx.tool.compiler.Console.print("qx.tool.cli.test.tooManyMakers");
            return null;
          }
          if (apps.length != 1) {
            qx.tool.compiler.Console.print(
              "qx.tool.cli.test.tooManyApplications"
            );
            return null;
          }
          maker = tmp;
          app = apps[0];
        }
      });
      if (!app) {
        qx.tool.compiler.Console.print("qx.tool.cli.test.noAppName");
        return null;
      }
      let env = app.getEnvironment();
      if (env["testtapper.testNameSpace"]) {
        qx.tool.compiler.Console.error(
          'environment["testtapper.testNameSpace"] is deprecated, use environment["qxl.testtapper.testNameSpace"] instead'
        );
        env["qxl.testtapper.testNameSpace"] = env["testtapper.testNameSpace"];
      }
      let config = command.getCompilerApi().getConfiguration();
      let listenPort = config?.serve?.listenPort ?? command.argv.listenPort;
      return {
        name: app.getName(),
        environment: env,
        argv: command.argv,
        listenPort: listenPort,
        maker: maker,
      };
    },
  },
});

module.exports = {
  LibraryApi: qxl.testtapper.compile.LibraryApi,
};
