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
        this.assertEquals('unresolved', e, "Timeout Rejected");
      }
    },
    "test03: async function exception": async function () {
      try {
        let value = await new Promise((resolve,reject) => {
          unknownFunctionCall();
        });
      } catch(exc) {
        let e = exc;
        this.assertEquals('unknownFunctionCall is not defined', e.message, "unknownFunctionCall");
      }
    },
    "test04: async exception": async function () {
      try {
        let value = await new Promise((resolve,reject) => {
          throw new Error("exc");
        });
      } catch(exc) {
        let e = exc;
        this.assertEquals('exc', e.message, "throw Error");
      }
    }
  }
});
