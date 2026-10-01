qx.Class.define("qxl.testtapperdemo.test.Test15AsyncTearDownRejection", {
  extend: qx.dev.unit.TestCase,
  members: {
    async tearDown() {
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error("expected rejection"));
        }, 100);
      });
    },
    "test01: async tearDown rejects"() {},
  },
});
