qx.Class.define("qxl.testtapperdemo.test.Test12AsyncRejection", {
  extend: qx.dev.unit.TestCase,
  members: {
    async "test01: async rejection"() {
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error("expected rejection"));
        }, 100);
      });
    },
  },
});
