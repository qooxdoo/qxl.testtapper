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
            qx.bom.History.getInstance().getState()
                .split(';').forEach(item => {
                    let [key,value] = item.split('=');
                    cfg[key] = value;
                });
            let main_container = new qx.ui.container.Composite();
            main_container.setLayout(new qx.ui.layout.VBox());
            main_container.add(
                new qx.ui.basic.Label(`
                <h1>TestTAPper - the Qooxdoo Testrunner is at work</h1>
                `).set({
                    rich: true
                })
            );
//            qx.log.appender.Native;
        	let logger = new qxl.logpane.LogPane();
			logger.setShowToolBar(false);
			logger.fetch();
            main_container.add(logger, {flex: 1});
			main_container.setHeight(640);
			main_container.setWidth(1024);
		    this.getRoot().add(main_container);


            let matcher = new RegExp("\\.test\\." + (cfg.module || ''));


            if (cfg.module) {
                this.log("# running only tests that match " + cfg.module);
            }
            let clazzes = Object.keys(qx.Class.$$registry)
            .filter(clazz => clazz.match(matcher))
            .sort();
            let pChain = new qx.Promise((resolve,reject) => resolve(true));
            clazzes.forEach(
                clazz => {
                    pChain = pChain.then(()=>
                        this.runAll(
                            qx.Class.$$registry[clazz]
                        ).then(()=>{
                            this.info(`# done testing ${clazz}.`);
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
        runAll: function(clazz) {
            let that = this;
            this.info(`# start testing ${clazz}.`);
            let methodNames = Object.keys(clazz.prototype)
                .filter(name => name.match(/^test/) && qx.Bootstrap.isFunctionOrAsyncFunction(clazz.prototype[name]))
                .sort();
            return new qx.Promise(resolve => {
                let pos = clazz.classname.lastIndexOf(".");
                let pkgname = clazz.classname.substring(0, pos);
                let loader = new qx.dev.unit.TestLoaderBasic(pkgname);
                let testResult = new qx.dev.unit.TestResult();
                let methodNameIndex = -1;
                let next = () => {
                    methodNameIndex++;
                    if (methodNameIndex < methodNames.length) {
                        loader.runTests(
                            testResult,
                            clazz.classname,
                            methodNames[methodNameIndex]
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

                loader.getSuite().add(clazz);
                testResult.addListener("startTest", evt => {
                    this.info('# start ' +evt.getData().getFullName());
                });
                testResult.addListener("wait", evt => {
                    this.info('# wait '+evt.getData().getFullName());
                });
                testResult.addListener("endMeasurement", evt => {
                    this.info('# endMeasurement '+evt.getData().getFullName());
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
