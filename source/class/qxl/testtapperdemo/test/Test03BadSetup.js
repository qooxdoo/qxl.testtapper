qx.Class.define("qxl.testtapperdemo.test.Test03BadSetup", {
  extend: qx.dev.unit.TestCase,
  members: {
    setUp() {
      this.callUnknownFunctionInSetup();
    },
    "test01: assert 1==1"() {
      this.assert(1 == 1, "One equals one");
    },
  },
});
