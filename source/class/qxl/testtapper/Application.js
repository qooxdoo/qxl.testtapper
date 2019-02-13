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
    extend: qx.application.Basic,
    members: {
        _cnt: null,
        main: function() {
            this.base(arguments);
            this._cnt = 0;
            // eslint-disable-next-line no-undef
            let cfg = {};
            qx.bom.History.getInstance().getState()
                .split(';').forEach(item => {
                    let [key,value] = item.split('=');
                    cfg[key] = value;
                });
            qx.log.appender.Native;
            let matcher = new RegExp("\\.test\\." + (cfg.module || ''));
            if (cfg.module) {
                console.log("# running only tests that match " + cfg.module);
            }
            let clazzes = Object.keys(qx.Class.$$registry)
                .filter(clazz => clazz.match(matcher));

            return new qx.Promise.all(clazzes.map(
                clazz => this.runAll(
                    qx.Class.$$registry[clazz])
                    .then(() => {
                            console.info(`# done testing ${clazz}.`);
                        }
                    )
                )
            ).then(() => {
                console.log(`1..${this._cnt}`);
            });
        },
        runAll: function(clazz) {
            let that = this;
            let methodNames = Object.keys(clazz.prototype)
                .filter(name => name.match(/^test/));
            return new qx.Promise(resolve => {
                let pos = clazz.classname.lastIndexOf(".");
                let pkgname = clazz.classname.substring(0, pos);
                let loader = new qx.dev.unit.TestLoaderBasic(pkgname);
                let testResult = new qx.dev.unit.TestResult();
                let methodNameIndex = -1;
                let next = () => {
                    methodNameIndex++;
                    if (!methodNames) {
                        console.log(`# run default tests for ${clazz.classname}`);
                        if (methodNameIndex === 0) {
                            loader.runTests(testResult, clazz.classname, null);
                        }
                        else {
                            resolve();
                        }
                    }
                    else if (methodNameIndex < methodNames.length) {
                        console.log(`# run ${clazz.classname}:${methodNames[methodNameIndex]}`);
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
                        that._cnt++;
                        let message = String(item.exception);
                        if (item.exception && item.exception.message) {
                            message = item.exception.message;
                        }
                        console.info(`not ok ${that._cnt} - ${message} ` + item.test.getClassName() + ":" + item.test.getName());
                        if (item.exception && !item.exception.message) {
                            console.error(item.exception);
                        }
                    });
                    setTimeout(next, 0);
                };

                loader.getSuite().add(clazz);

                testResult.addListener("endTest", evt => {
                    that._cnt++;
                    console.info(`ok ${that._cnt} - ` + evt.getData().getFullName());
                    setTimeout(next, 0);
                });
                testResult.addListener("wait", evt => {
                    that._cnt++;
                    console.info(`not ok ${that._cnt} - stop waiting for ` + evt.getData().getFullName());
                });
                testResult.addListener("failure", evt => showExceptions(evt.getData()));
                testResult.addListener("error", evt => showExceptions(evt.getData()));
                testResult.addListener("skip", evt => {
                    that._cnt++;
                    console.info(`ok ${that._cnt} - # SKIP ` + evt.getData().getFullName());
                });

                next();
            });
        }
    }
});
