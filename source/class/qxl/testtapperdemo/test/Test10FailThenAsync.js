/**
 * A failing test followed by an asynchronous test must not disturb the
 * asynchronous test: only test01 may fail.
 */
qx.Class.define("qxl.testtapperdemo.test.Test10FailThenAsync", {
  extend: qx.dev.unit.TestCase,
  members: {
    "test01: fail"() {
      this.fail("expected failure");
    },
    "test02: async after failure"() {
      window.setTimeout(() => {
        this.resume();
      }, 500);
      this.wait(2000);
    },
    "test03: sync after async"() {
      this.assert(true);
    },
  },
});
