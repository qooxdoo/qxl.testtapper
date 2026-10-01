qx.Class.define("qxl.testtapperdemo.test.Test13AsyncSetUp", {
  extend: qx.dev.unit.TestCase,
  members: {
    __ready: false,
    __tornDown: false,
    async setUp() {
      this.__ready = false;
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      this.__ready = true;
    },
    async tearDown() {
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      this.__tornDown = true;
    },
    "test01: setUp settled before the test"() {
      this.assertTrue(this.__ready, "async setUp has not finished");
    },
    "test02: tearDown settled before the next test"() {
      this.assertTrue(this.__tornDown, "async tearDown has not finished");
    },
    "test03: setUp settled again"() {
      this.assertTrue(this.__ready, "async setUp has not finished");
    },
  },
});
