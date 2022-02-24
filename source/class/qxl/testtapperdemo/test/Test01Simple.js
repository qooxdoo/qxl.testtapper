qx.Class.define("qxl.testtapperdemo.test.Test01Simple", {
  extend: qx.dev.unit.TestCase,
  members: {
    setUp() {
      console.debug("# Setup for TestCase");
    },
    tearDown() {
      console.debug("# Teardown for TestCase");
    },
    "test01: got array ?"() {
      this.assertArray([], "This is an array");
    },
    "test02: assert 1==1"() {
      this.assert(1 == 1, "One equals one");
    },
  },
});
