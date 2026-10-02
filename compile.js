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
      if (!cmd.getFlag("class")) {
        cmd.addFlag(
          new qx.tool.cli.Flag("class").set({
            description: "only run tests of this class",
            type: "string"
          })
        );
      }

      if (!cmd.getFlag("method")) {
        cmd.addFlag(
          new qx.tool.cli.Flag("method").set({
            description: "only run tests of this method",
            type: "string"
          })
        );
      }

      if (!cmd.getFlag("diag")) {
        cmd.addFlag(
          new qx.tool.cli.Flag("diag").set({
            description: "show diagnostic output",
            type: "boolean",
            value: false
          })
        );
      }

      if (!cmd.getFlag("terse")) {
        cmd.addFlag(
          new qx.tool.cli.Flag("terse").set({
            description: "show only summary and errors",
            type: "boolean",
            value: false
          })
        );
      }

      if (!cmd.getFlag("stackTrace")) {
        cmd.addFlag(
          new qx.tool.cli.Flag("stackTrace").set({
            description: "prints the stacktrace in case of error",
            type: "boolean",
            value: false
          })
        );
      }

      if (!cmd.getFlag("coverage")) {
        cmd.addFlag(
          new qx.tool.cli.Flag("coverage").set({
            description: "writes coverage infos, only working for chromium yet",
            type: "boolean"
          })
        );
      }

      if (!cmd.getFlag("headless")) {
        cmd.addFlag(
          new qx.tool.cli.Flag("headless").set({
            description: "runs test headless",
            type: "boolean"
          })
        );
      }

      if (!cmd.getFlag("browsers")) {
        cmd.addFlag(
          new qx.tool.cli.Flag("browsers").set({
            description: "list of browsers to test against, currently supported chromium, firefox, webkit",
            type: "string",
            value: "chromium"
          })
        );
      }
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
      let result = data.getData();
      let app;
      try {
        app = this.__getTestApp("qxl.testtapper.Application");
      } catch (e) {
        qx.tool.compiler.Console.error(e.message);
        result.setExitCode(253);
        return qx.Promise.resolve(false);
      }
      if (!app) {
        // no testtapper app in the groups selected with --app-group
        return qx.Promise.resolve(false);
      }
      return this.__runTests(app, result);
    },

    __runTestInBrowser(browserType, url, app, result) {
      return new qx.Promise(async (resolve, reject) => {
        try {
          if (!["chromium", "firefox", "webkit"].includes(browserType)) {
            reject(new Error(`unknown browser ${browserType}`));
            return;
          }
          if (!this.__playwright) {
            this.__playwright = this.require("playwright");
          }
          // only set up the browser this run needs
          const { execSync } = require("child_process");
          let s = `npx playwright install-deps ${browserType}`;
          qx.tool.compiler.Console.info(s);
          try {
            execSync(s, {
              stdio: "inherit"
            });
          } catch (e) {
            // install-deps needs root; without it the libraries may well be
            // installed already. If not, launch() below says what is missing.
            qx.tool.compiler.Console.warn(
              `${browserType}: '${s}' failed, trying to launch the browser anyway`
            );
          }
          s = `npx playwright install ${browserType}`;
          qx.tool.compiler.Console.info(s);
          execSync(s, {
            stdio: "inherit"
          });
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
          const context = await browser.launch(launchArgs);
          const page = await context.newPage();
          // without these the promise stays pending when the browser dies
          // before the test app has printed its "1..N" plan line
          let finished = false;
          const fail = (msg) => {
            if (!finished) {
              reject(new Error(msg));
            }
          };
          context.on("disconnected", () =>
            fail("browser closed before the tests finished")
          );
          page.on("crash", () => fail("page crashed"));
          page.on("close", () => fail("page closed before the tests finished"));
          // an uncaught error before the first test result means the test
          // app did not start, so it never prints its "1..N" plan line
          let started = false;
          page.on("pageerror", (err) => {
            qx.tool.compiler.Console.error(
              `${browserType}: page error: ${err.stack || err}`
            );
            if (!started) {
              fail(`test app did not start: ${err.message}`);
            }
          });
          let cov =
            (app.argv.coverage === null
              ? app.environment["qxl.testtapper.coverage"] === null
                ? false
                : app.environment["qxl.testtapper.coverage"]
              : app.argv.coverage) && browserType === "chromium";
          if (cov) {
            if (!this.__v8toIstanbul) {
              this.__v8toIstanbul = this.require("v8-to-istanbul");
            }
            await page.coverage.startJSCoverage();
          }
          let Ok = 0;
          let notOk = 0;
          let skipped = 0;
          let startTime;
          const onConsole = async (msg) => {
            let val = msg.text();
            // value is serializable
            if (val.match(/^\d+\.\.\d+$/)) {
              finished = true;
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
                for await (const entry of coverage) {
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
                  const filePath = path.join(process.cwd(), outputDir, url.pathname);
                  const converter = new this.__v8toIstanbul(filePath, 0, {
                    source: source,
                  });

                  await converter.load();
                  converter.applyCoverage(entry.functions);
                  Object.assign(entries, converter.toIstanbul());
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
              started = true;
              notOk++;
              qx.tool.compiler.Console.log(`${browserType}: ${val}`);
            } else if (val.includes("# SKIP")) {
              started = true;
              skipped++;
              if (!app.argv.terse) {
                qx.tool.compiler.Console.log(`${browserType}: ${val}`);
              }
            } else if (val.match(/^ok\s/)) {
              started = true;
              Ok++;
              if (!app.argv.terse) {
                qx.tool.compiler.Console.log(`${browserType}: ${val}`);
              }
            } else if (val.match(/^#/) && app.argv.diag) {
              qx.tool.compiler.Console.log(`${browserType}: ${val}`);
            } else if (app.argv.verbose) {
              qx.tool.compiler.Console.log(`${browserType}: ${val}`);
            }
          };
          // an error in the async listener (e.g. while writing coverage)
          // would otherwise be lost and leave this promise pending forever
          page.on("console", (msg) => onConsole(msg).catch(reject));
          startTime = performance.now();
          await page.goto(url.href);
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
      let s = "";
      if (app.argv.stackTrace) {
        s += "stackTrace";
      }
      if (app.argv.method) {
        if (s.length > 0) {
          s += "&";
        }
        s += "method=" + app.argv.method;
      }
      if (app.argv.class) {
        if (s.length > 0) {
          s += "&";
        }
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
      // a failing browser must not reject Promise.all: qx test would then
      // never reach its process.exit() and keep serving forever
      let tests = browsers.map((browserType) =>
        this.__runTestInBrowser(browserType, url, app, result).catch((e) => {
          qx.tool.compiler.Console.error(`${browserType}: ${e.stack || e}`);
          exitCode = 253;
          return 0;
        })
      );
      let res = await Promise.all(tests);
      // exit codes (#36): 253 an exception, 1-252 the number of failed
      // tests, 254 all tests passed but a filter skipped the others
      if (exitCode === 0) {
        let sum = res.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
        if (sum > 0) {
          exitCode = Math.min(sum, 252);
        } else if (app.argv.method || app.argv.class) {
          exitCode = 254;
        }
      }
      if (exitCode > 0) {
        result.setExitCode(exitCode);
      }
    },

    /**
     * The groups of an application from compile.json. qooxdoo 8.0 beta
     * keeps them only in the application's config entry; newer compilers
     * also copy them into Application.getGroup().
     */
    __getAppGroups(app) {
      let groups = typeof app.getGroup == "function" ? app.getGroup() : null;
      if (!groups) {
        let appConfigs =
          this.getCompilerApi().getConfiguration().applications || [];
        let appConfig = appConfigs.find(
          (c) => c.app === app || (c.name && c.name === app.getName())
        );
        groups = appConfig?.group;
      }
      if (typeof groups == "string") {
        groups = [groups];
      }
      return groups || [];
    },

    __getTestApp(classname) {
      let command = this.getCompilerApi().getCommand();
      let maker = null;
      let app = null;
      let argvAppGroups = command.argv["app-group"]
        ? command.argv["app-group"].split(",").map(s => s.trim())
        : null;
      if (!command.getMakers()) {
        throw new Error("Cannot run tests: no compile targets found");
      }
      for (const tmp of command.getMakers()) {
        let apps = tmp
          .getApplications()
          .filter(
            (app) => app.getClassName() === classname && app.isBrowserApp()
          );
        if (argvAppGroups) {
          apps = apps.filter(app => {
            let groups = this.__getAppGroups(app);
            return argvAppGroups.some(g => groups.includes(g));
          });
        }
        if (apps.length) {
          if (maker) {
            throw new Error(
              "Cannot run tests: the testtapper application is in more than one target"
            );
          }
          if (apps.length != 1) {
            throw new Error(
              "Cannot run tests: there is more than one testtapper application, select one with --app-group"
            );
          }
          maker = tmp;
          app = apps[0];
        }
      }
      if (!app) {
        if (argvAppGroups) {
          return null;
        }
        throw new Error(
          "Please install testtapper application in compile.json"
        );
      }
      let env = app.getEnvironment();
      if (env["testtapper.testNameSpace"]) {
        qx.tool.compiler.Console.error(
          'environment["testtapper.testNameSpace"] is deprecated, use environment["qxl.testtapper.testNameSpace"] instead'
        );
        env["qxl.testtapper.testNameSpace"] = env["testtapper.testNameSpace"];
      }
      let config = command.getCompilerApi().getConfiguration();
      // same order as qx.tool.compiler.cli.commands.Serve, so the
      // browser is sent to the port the web server listens on
      let listenPort = command.argv.listenPort ?? config?.serve?.listenPort;
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
