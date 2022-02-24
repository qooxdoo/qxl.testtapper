qx.Class.define("qxl.testtapperdemo.test.Test04BadTearDown", {
  extend: qx.dev.unit.TestCase,
  members: {
    tearDown() {
      this.CallingUnknownFunctionInTeardown();
    },
    "test01: assert 1==1"() {
      this.assert(1 == 1, "One equals one");
    },
  },
});
