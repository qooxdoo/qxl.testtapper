/* ************************************************************************

   Copyright: 2018 Oetiker+Partner AG

   License: MIT

   Authors: Tobias Oetiker

************************************************************************ */
/**
 * Test Runner
 *
 * @asset(qxl/testtapper/run.js)
 */
qx.Class.define("qxl.testtapper.Application", {
    extend: qx.application.Standalone,
    members: {
        _cnt: null,
        _failed: null,
        log: function(text) {
           console.log(text);
           qx.log.Logger.debug(text);
        },
        info: function(text) {
           console.log(text);
           qx.log.Logger.info(text);
        },
        error: function(text) {
           console.log(text);
           qx.log.Logger.error(text);
        },
        main: function() {
            this.base(arguments);
            this._cnt = 0;
            this._failed = {};
            // eslint-disable-next-line no-undef
            let cfg = {};
            if (typeof location !== "undefined" && location.search) {
                let params = decodeURI(location.search.substring(1));
                params += "&";
                params.split('&').forEach(item => {
                    if (item.length) {
                       let [key,value] = item.split('=');
                       cfg[key] = value;
                    }
                });
            }
            let main_container = new qx.ui.container.Composite();
            main_container.setLayout(new qx.ui.layout.VBox());
            main_container.add(
                new qx.ui.basic.Label(`
                <h1>TestTAPper - the Qooxdoo Testrunner is at work</h1>
                `).set({
                    rich: true
                })
            );
        	let logger = new qxl.logpane.LogPane();
			logger.setShowToolBar(false);
			logger.fetch();
            main_container.add(logger, {flex: 1});
			main_container.setHeight(640);
			main_container.setWidth(1024);
		    this.getRoot().add(main_container);

            this.loader = new qx.dev.unit.TestLoaderBasic();
            let namespace = qx.core.Environment.get("testtapper.testNameSpace") || "qx.test";
            this.loader.setTestNamespace(namespace);
            let clazzes = this.loader.getSuite().getTestClasses();
            if (cfg.class) {
                let matcher = new RegExp(cfg.class);                
                this.log("# running only test classes that match " + matcher);
                clazzes = clazzes.filter(clazz => clazz.getName().match(matcher));
            }

            let pChain = new qx.Promise((resolve) => resolve(true));
			clazzes.forEach(
                clazz => {
                    pChain = pChain.then(()=>
                        this.runAll(cfg, clazz)
                            .then( () => {this.info(`# done testing ${clazz.getName()}.`);
                            })
                    );
                }
            );

            return pChain.then(() => {
                this.log(`1..${this._cnt}`);
                main_container.add(
                    new qx.ui.basic.Label(`
                    <h1>TestTAPper - is Done</h1>
                    `).set({
                        rich: true
                    })
                );
            });
        },

        runAll: function(cfg, clazz) {
            let that = this;
            this.info(`# start testing ${clazz.getName()}.`);
            let methods = clazz.getTestMethods();
            if (cfg.method) {
                let matcher = new RegExp(cfg.method);                
                this.log("# running only test methods that match " + matcher);
                methods = methods.filter(method => method.getName().match(matcher));
            }

            return new qx.Promise(resolve => {
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
                    }
                    else {
                        resolve();
                    }
                };
                let showExceptions = arr => {
                    arr.forEach(item => {
                        if (item.test.getFullName){
                            let test = item.test.getFullName();
                            that._failed[test] = true;
                            that._cnt++;
                            let message = String(item.exception);
                            if (item.exception) {
                                if (item.exception.message) {
                                message = item.exception.message;
                                this.info(`not ok ${that._cnt} - ${test} - ${message}`);
                                }
                                else {
                                    this.error('# '+item.exception);
                                }
                            }
                        }
                        else {
                            this.error('Unexpected Error - ',item);
                        }
                    });
                    setTimeout(next, 0);
                };
                testResult.addListener("startTest", evt => {
                    this.info('# start ' +evt.getData().getFullName());
                });
                testResult.addListener("wait", evt => {
                    this.info('# wait '+evt.getData().getFullName());
                });
                testResult.addListener("endMeasurement", evt => {
                    this.info('# endMeasurement '+ evt.getData()[0].test.getFullName());
                });
                testResult.addListener("endTest", evt => {
                    let test = evt.getData().getFullName();
                    if (!that._failed[test]){
                        that._cnt++;
                        this.info(`ok ${that._cnt} - ` + test);
                    }
                    setTimeout(next, 0);
                });
                testResult.addListener("failure", evt => showExceptions(evt.getData()));
                testResult.addListener("error", evt => showExceptions(evt.getData()));
                testResult.addListener("skip", evt => {
                    that._cnt++;
                    let test = evt.getData()[0].test.getFullName();
                    that._failed[test] = true;
                    this.info(`ok ${that._cnt} - # SKIP ${test}`);
                });
                next();
            });
        }
    }
});
