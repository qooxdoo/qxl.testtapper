

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
          type: "boolean"
        };
        args.builder.terse = {
          describe: "show only summary and errors",
          type: "boolean"
        };
        return args;
      }
    },

    // @overridden 
    load: async function() {
      let command = this.getCompilerApi().getCommand();
      if (command instanceof qx.tool.cli.commands.Test) {
         command.addListener("runTests", this.__onRunTests, this);
         if (command.setNeedsServer) {
          command.setNeedsServer(true);
        }
      }
    },

    __onRunTests: function(data) {
      let app = this.getTestApp("qxl.testtapper.Application");
      if (!app) {
        qx.tool.compiler.Console.print("Please install testtapper application in compile.json");
        return qx.Promise.resolve(false);
      }
      let result = data.getData?data.getData():{};
      return this.runTest(app, result);
    },

     runTest : async function (app, result) {
      return new qx.Promise(async (resolve) => {
        const puppeteer = this.require("puppeteer");
        const pti = this.require("puppeteer-to-istanbul");
        let outputDir = "";
        if (this.getCompilerApi().getCommand().showStartpage()) {
          let target = app.maker.getTarget(); 
          outputDir = target.getOutputDir();
        }
        let href = `http://localhost:${app.port}/${outputDir}${app.name}/`;
        const { URL } = require("url");
        let url = new URL(href);
        let s = ""
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
        qx.tool.compiler.Console.log("CALL "+ url.href);
        let notOk = 0;
        let Ok = 0;
        let browser = await puppeteer.launch({args: ['--no-sandbox']});
        let page = await browser.newPage();
        page.on("console", async (msg) => {
          let val = msg.text();
          // value is serializable
          if  (val.match(/^\d+\.\.\d+$/)) {
            qx.tool.compiler.Console.info(`DONE testing ${Ok} ok, ${notOk} not ok`);
            let jsCoverage = await page.coverage.stopJSCoverage();
            qx.tool.compiler.Console.info("writing coverage information ...");
            await pti.write(jsCoverage);
            await browser.close();
            result.errorCode += notOk;
            result[app.name] = {
              notOk: notOk,
              ok: Ok
            };
            resolve(result[app.name]);
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
        await page.coverage.startJSCoverage();
        await page.goto(url.href);
      });
    },

    getTestApp: function(classname) {
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
      var config = command._getConfig();
      return {
        name: app.getName(),
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
