qx.Class.define("qxl.testtapperdemo.test.Test14AsyncSetUpRejection", {
  extend: qx.dev.unit.TestCase,
  members: {
    async setUp() {
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error("expected rejection"));
        }, 100);
      });
    },
    "test01: async setUp rejects"() {},
  },
});
