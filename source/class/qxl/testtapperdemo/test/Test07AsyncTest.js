qx.Class.define("qxl.testtapperdemo.test.Test07AsyncTest", {
  extend: qx.dev.unit.TestCase,
  members: {
    "test01: in-time"() {
      window.setTimeout(() => {
        this.resume();
      }, 500);
      this.wait(2000);
    },
    "test02: timeout"() {
      this.wait(500);
    },
  },
});
