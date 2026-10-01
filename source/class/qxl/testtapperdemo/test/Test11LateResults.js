/**
 * Keeps the run going for a few seconds, so that results arriving late from
 * a disturbed Test10FailThenAsync still get counted.
 */
qx.Class.define("qxl.testtapperdemo.test.Test11LateResults", {
  extend: qx.dev.unit.TestCase,
  members: {
    "test01: wait for late results"() {
      window.setTimeout(() => {
        this.resume();
      }, 3000);
      this.wait(5000);
    },
  },
});
