const { promisify } = require('util');
const fs = require('fs');
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const path = require('path');
const { URL } = require("url");

qx.Class.define("qxl.testtapper.compile.LibraryApi", {
  extend: qx.tool.cli.api.LibraryApi,

  members: {

    // @overridden 
    async initialize() {
      let yargs = qx.tool.cli.commands.Test.getYargsCommand;
      qx.tool.cli.commands.Test.getYargsCommand = () => {
        let args = yargs();
        args.builder.class = {
          describe: "only run tests of this class",
          type: "string"
        };
        args.builder.method = {
          describe: "only run tests of this method",
          type: "string"
        };
        args.builder.diag = {
          describe: "show diagnostic output",
          type: "boolean",
          default: false
        };
        args.builder.terse = {
          describe: "show only summary and errors",
          type: "boolean",
          default: false
        };
        /*        
                args.builder.coverage = {
                  describe: "writes coverage infos, only working for chromium yet",
                  type: "boolean",
                  default: false
                };
        */
        args.builder.headless = {
          describe: "runs test headless",
          type: "boolean"
        };
        args.builder.browsers = {
          describe: "writes coverage infos, only working for chromium yet",
          type: "string"
        };
        return args;
      }
    },

    __enviroment: null,
    // @overridden 
    load: async function () {
      let command = this.getCompilerApi().getCommand();
      if (command instanceof qx.tool.cli.commands.Test) {
        command.addListener("runTests", this.__testIt, this);
        if (command.setNeedsServer) {
          command.setNeedsServer(true);
        }
      }
    },

    __testIt: function (data) {
      let app = this.__getTestApp("qxl.testtapper.Application");
      if (!app) {
        qx.tool.compiler.Console.error("Please install testtapper application in compile.json");
        return qx.Promise.resolve(false);
      }
      let result = data.getData();
      return this.__runTests(app, result);
    },


    __runTestInBrowser(browserType, url, app, result) {
      return new qx.Promise(async (resolve, reject) => {
        try {
          const playwright = this.require('playwright');
          const v8toIstanbul = this.require('v8-to-istanbul');
          console.info("TESTTAPPER: Running test in " + browserType);
          const launchArgs = {
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox'
            ],
            headless: (app.argv.headless === null)?(app.environment["qxl.testtapper.headless"] === null)?true:app.environment["qxl.testtapper.headless"]):app.argv.headless;
          };
          const browser = playwright[browserType];
          if (!browser) {
            reject(new Error(`unknown browser ${browserType}`));
          }
          const context = await browser.launch(launchArgs);
          const page = await context.newPage();
          let cov = (app.argv.coverage ?? app.environment["qxl.testtapper.coverage"] ?? false) && (browserType === "chromium");
          if (cov) {
            await page.coverage.startJSCoverage();
          }
          let Ok = 0;
          let notOk = 0;
          page.on("console", async (msg) => {
            let val = msg.text();
            // value is serializable
            if (val.match(/^\d+\.\.\d+$/)) {
              qx.tool.compiler.Console.info(`DONE testing ${Ok} ok, ${notOk} not ok`);
              if (cov) {
                qx.tool.compiler.Console.info("writing coverage information ...");
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
                  const converter = new v8toIstanbul(filePath, 0, {
                    source: source
                  });
                  await converter.load();
                  converter.applyCoverage(entry.functions);
                  const instanbul = converter.toIstanbul();
                  entries[filePath] = instanbul[filePath];
                }
                await mkdir(path.join(process.cwd(), '.nyc_output'), { recursive: true });
                await writeFile(path.join(process.cwd(), '.nyc_output', 'out.json'), JSON.stringify(entries));
              }
              await context.close();
              result[app.name][browserType] = {
                notOk: notOk,
                ok: Ok
              };
              result.setExitCode(result.getExitCode() + notOk);
              resolve();
            } else if (val.match(/^not ok /)) {
              notOk++;
              qx.tool.compiler.Console.log(val);
            } else if (val.match(/^ok\s/)) {
              Ok++;
              if (!app.argv.terse) {
                qx.tool.compiler.Console.log(val);
              }
            } else if (val.match(/^#/) && app.argv.diag) {
              qx.tool.compiler.Console.log(val);
            } else if (app.argv.verbose) {
              qx.tool.compiler.Console.log(val);
            }
          });
          page.goto(url.href);
        } catch (e) {
          reject(e);
        }
      });
    },

    __runTests: async function (app, result) {
      let outputDir = "";
      if (this.getCompilerApi().getCommand().showStartpage()) {
        let target = app.maker.getTarget();
        outputDir = target.getOutputDir();
      }
      let href = `http://localhost:${app.port}/${outputDir}${app.name}/`;
      let url = new URL(href);
      let s = "";
      if (app.argv.method) {
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
      let browsers = (app.argv.browsers || "").split(",").filter(s => s.length > 0);
      if (browsers.length === 0) {
        browsers = app.environment["qxl.testtapper.browsers"];
      }
      if (!browsers || browsers.length === 0) {
        browsers = ["chromium"];
      }
      for (const browserType of browsers) {
        try {
          await this.__runTestInBrowser(browserType, url, app, result);
        } catch (e) {
          qx.tool.compiler.Console.error(e);
        }
      }
    },

    __getTestApp: function (classname) {
      let command = this.getCompilerApi().getCommand();
      let maker = null;
      let app = null;
      command.getMakers().forEach(tmp => {
        let apps = tmp.getApplications().filter(app => (app.getClassName() === classname) && app.isBrowserApp());
        if (apps.length) {
          if (maker) {
            qx.tool.compiler.Console.print("qx.tool.cli.test.tooManyMakers");
            return null;
          }
          if (apps.length != 1) {
            qx.tool.compiler.Console.print("qx.tool.cli.test.tooManyApplications");
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
        qx.tool.compiler.Console.error('environment["testtapper.testNameSpace"] is deprecated, use environment["qxl.testtapper.testNameSpace"] instead');
        env["qxl.testtapper.testNameSpace"] = env["testtapper.testNameSpace"];
      }
      var config = command._getConfig();
      return {
        name: app.getName(),
        environment: env,
        port: config.serve.listenPort,
        argv: command.argv,
        maker: maker
      }
    }
  }
});

module.exports = {
  LibraryApi: qxl.testtapper.compile.LibraryApi
};
