qx.Class.define("qxl.testtapperdemo.test.Test09AsyncFunction", {
  extend: qx.dev.unit.TestCase,
  members: {
    async "test01: async function"() {
      let value = await new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve("resolved");
        }, 1000);
      });
      this.assertEquals("resolved", value, "Timeout Resolved");
    },
    async "test02: async function fail"() {
      try {
        let value = await new Promise((resolve, reject) => {
          setTimeout(() => {
            reject("unresolved");
          }, 1000);
        });
      } catch (e) {
        this.assertEquals("unresolved", e, "Timeout Rejected");
      }
    },
    async "test03: async function exception"() {
      try {
        let value = await new Promise((resolve, reject) => {
          unknownFunctionCall();
        });
      } catch (exc) {
        let e = exc;
        this.assertEquals(
          "unknownFunctionCall is not defined",
          e.message,
          "unknownFunctionCall"
        );
      }
    },
    async "test04: async exception"() {
      try {
        let value = await new Promise((resolve, reject) => {
          throw new Error("exc");
        });
      } catch (exc) {
        let e = exc;
        this.assertEquals("exc", e.message, "throw Error");
      }
    },
    async "test05: wait() after await"() {
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      this.wait(200, () => {
        this.assert(true);
      });
    },
    async "test06: async assertion fails"() {
      let value = await new Promise((resolve) => {
        setTimeout(() => {
          resolve("resolved");
        }, 100);
      });
      this.assertEquals("expected", value, "expected failure");
    },
  },
});
