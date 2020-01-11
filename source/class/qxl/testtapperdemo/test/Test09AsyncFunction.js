qx.Class.define("qxl.testtapperdemo.test.Test09AsyncFunction", {
  extend: qx.dev.unit.TestCase,
  members: {
    "test01: async function": async function () {
      let value = await new Promise((resolve,reject) => {
        setTimeout(() => {
          resolve('resolved');
        }, 1000);
      });
      this.assertEquals('resolved', value, "Timeout Resolved");
    },
    "test02: async function fail": async function () {
      try {
        let value = await new Promise((resolve,reject) => {
          setTimeout(() => {
            reject('unresolved');
          }, 1000);
        });
      } catch(e) {
        this.assertEquals('unresolved', e, "Timeout Resolved");
      }
    },
    "test03: async function exception": async function () {
      let value = await new Promise((resolve,reject) => {
        setTimeout(() => {
          resolve('resolved');
        }, 1000);
      });
      unknownFunctionCall();
    }
  }
});
