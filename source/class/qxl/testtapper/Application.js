/* ************************************************************************

   Copyright: 2018 Oetiker+Partner AG

   License: MIT

   Authors: Tobias Oetiker

************************************************************************ */
/**
 * Test Runner
 *
 * @asset(qxl/testtapper/run.js)
 * @asset(qx/icon/Oxygen/16/actions/dialog-ok.png)
 * @asset(qx/icon/Oxygen/16/actions/dialog-cancel.png)
 * @asset(qx/icon/Tango/16/places/folder.png)
 * @asset(qx/icon/Tango/16/places/folder-open.png)
 */
qx.Class.define("qxl.testtapper.Application", {
  extend: qx.application.Standalone,
  members: {
    _cnt: null,
    _failed: null,
    __tree: null,
    __model: null,
    log(text) {
      console.log(text);
      qx.log.Logger.debug(text);
    },
    info(text) {
      console.info(text);
      qx.log.Logger.info(text);
    },
    error(text) {
      console.error(text);
      qx.log.Logger.error(text);
    },

    // add an item in the tree
    addTreeItem(status, testNumber, testClass, testName, message = "") {
      let classNode = this.__model
        .getChildren()
        .toArray()
        .find((item) => item.getLabel() === testClass);
      if (!classNode) {
        classNode = qx.data.marshal.Json.createModel({
          label: testClass,
          children: [],
          numberPassed: 0,
          numberFailed: 0,
        });

        this.__model.getChildren().append(classNode);
      }
      let modelItem = qx.data.marshal.Json.createModel({
        label: testNumber + " " + testName,
        numberPassed: Number(status === "ok"),
        numberFailed: Number(status === "not ok"),
        message,
      });

      classNode.getChildren().push(modelItem);
      // update parent nodes
      [classNode, this.__model].forEach((node) => {
        node.setNumberPassed(
          node
            .getChildren()
            .reduce((acc, curr) => acc + curr.getNumberPassed(), 0)
        );
        node.setNumberFailed(
          node
            .getChildren()
            .reduce((acc, curr) => acc + curr.getNumberFailed(), 0)
        );
      });
    },

    getRootNodeData() {
      return {
        label: "Running tests...",
        children: [],
        numberPassed: 0,
        numberFailed: 0,
      };
    },

    main() {
      super.main();
      this._cnt = 0;
      this._failed = {};
      // eslint-disable-next-line no-undef
      let cfg = {};
      if (typeof location !== "undefined" && location.search) {
        let params = decodeURI(location.search.substring(1));
        params += "&";
        params.split("&").forEach((item) => {
          if (item.length) {
            let [key, value] = item.split("=");
            cfg[key] = value;
          }
        });
      }
      let main_container = new qx.ui.container.Composite();
      main_container.setLayout(new qx.ui.layout.VBox());
      main_container.add(
        new qx.ui.basic.Label(`
                <h1>TestTAPper - the Qooxdoo Testrunner is at work</h1>
                <p>For details, please open your browser's javascript console</p>
                `).set({
          rich: true,
        })
      );

      this.getRoot().add(main_container, { edge: 5 });

      // tree
      var scroller = new qx.ui.container.Scroll();
      var container = new qx.ui.container.Composite(new qx.ui.layout.Grow());
      //container.setAllowGrowX(false);
      //container.setAllowStretchX(false);
      scroller.add(container);
      const tree = (this.__tree = new qx.ui.tree.VirtualTree(
        null,
        "label",
        "children"
      ));
      container.add(tree);
      const delegate = {
        bindItem(controller, item, id) {
          controller.bindDefaultProperties(item, id);
          ["numberPassed", "numberFailed", "message"].forEach((prop) =>
            controller.bindProperty(prop, prop, null, item, id)
          );
        },
        createItem() {
          return new qxl.testtapper.TreeItem();
        },
      };

      tree.setDelegate(delegate);
      let model = (this.__model = qx.data.marshal.Json.createModel(
        this.getRootNodeData(),
        true
      ));
      tree.setModel(model);

      // log pane
      let logger = new qxl.logpane.LogPane();
      logger.setShowToolBar(false);
      logger.fetch();

      // splitpane
      var pane = new qx.ui.splitpane.Pane("vertical");
      main_container.add(pane, { flex: 1 });
      pane.add(scroller);
      pane.add(logger);

      // loader
      this.loader = new qx.dev.unit.TestLoaderBasic();
      let namespace =
        qx.core.Environment.get("qxl.testtapper.testNameSpace") || "qx.test";
      this.loader.setTestNamespace(namespace);
      let clazzes = this.loader.getSuite().getTestClasses();
      if (cfg.class) {
        let matcher = new RegExp(cfg.class);
        this.log("# running only test classes that match " + matcher);
        clazzes = clazzes.filter((clazz) => clazz.getName().match(matcher));
      }

      let pChain = new qx.Promise((resolve) => resolve(true));
      clazzes.forEach((clazz) => {
        pChain = pChain.then(() =>
          this.runAll(cfg, clazz).then(() => {
            this.info(`# done testing ${clazz.getName()}.`);
          })
        );
      });

      return pChain.then(() => {
        this.log(`1..${this._cnt}`);
        this.__model.setLabel("Tests have finished:");
      });
    },

    runAll(cfg, clazz) {
      let that = this;
      this.info(`# start testing ${clazz.getName()}.`);
      let methods = clazz.getTestMethods();
      if (cfg.method) {
        let matcher = new RegExp(cfg.method);
        this.log("# running only test methods that match " + matcher);
        methods = methods.filter((method) => method.getName().match(matcher));
      }

      return new qx.Promise((resolve) => {
        let testResult = new qx.dev.unit.TestResult();
        let methodNameIndex = -1;
        let next = () => {
          methodNameIndex++;
          if (methodNameIndex < methods.length) {
            that.loader.runTests(
              testResult,
              clazz.getName(),
              methods[methodNameIndex].getName()
            );
          } else {
            resolve();
          }
        };
        let startTime;
        let numberFormat = new qx.util.format.NumberFormat("en");
        numberFormat.set({
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
          postfix: " ms",
        });

        let showExceptions = (arr) => {
          arr.forEach((item) => {
            if (item.test.getFullName) {
              let endTime = performance.now();
              let timeDiff = endTime - startTime;
              let test = item.test.getFullName();
              that._failed[test] = true;
              that._cnt++;
              if (item.exception) {
                if (item.exception.message) {
                  let message = item.exception.toString();
                  if (cfg.stackTrace) {
                     message = `${item.exception.getComment?item.exception.getComment():message}\n${item.exception.stack}`;
                  }
                  this.info(
                    `not ok ${that._cnt} - ${test} - [${numberFormat.format(
                      timeDiff
                    )}] - ${message}`
                  );
                  let [testClass, ...testName] = test.split(":");
                  this.addTreeItem(
                    "not ok",
                    that._cnt,
                    testClass,
                    testName.join(""),
                    message
                  );
                } else {
                  this.error("# " + item.exception.toString());
                }
              }
            } else {
              this.error("Unexpected Error - ", item);
            }
          });
          setTimeout(next, 0);
        };
        testResult.addListener("startTest", (evt) => {
          this.info("# start " + evt.getData().getFullName());
          startTime = performance.now();
        });
        testResult.addListener("wait", (evt) => {
          this.info("# wait " + evt.getData().getFullName());
        });
        testResult.addListener("endMeasurement", (evt) => {
          this.info("# endMeasurement " + evt.getData()[0].test.getFullName());
        });
        testResult.addListener("endTest", (evt) => {
          let endTime = performance.now();
          let timeDiff = endTime - startTime;
          let test = evt.getData().getFullName();
          if (!that._failed[test]) {
            that._cnt++;
            this.info(
              `ok ${that._cnt} - ${test} - [${numberFormat.format(timeDiff)}]`
            );
            let [testClass, ...testName] = test.split(":");
            this.addTreeItem("ok", that._cnt, testClass, testName.join(""));
          }
          setTimeout(next, 0);
        });
        testResult.addListener("failure", (evt) =>
          showExceptions(evt.getData())
        );
        testResult.addListener("error", (evt) => showExceptions(evt.getData()));
        testResult.addListener("skip", (evt) => {
          that._cnt++;
          let test = evt.getData()[0].test.getFullName();
          that._failed[test] = true;
          this.info(
            `ok ${that._cnt} - # SKIP ${test} - ${evt
              .getData()[0]
              .exception.toString()}`
          );
        });
        next();
      });
    },
  },
});
