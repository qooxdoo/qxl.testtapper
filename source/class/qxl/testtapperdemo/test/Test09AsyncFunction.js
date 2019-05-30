
function resolveAfter1Seconds() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve('resolved');
    }, 1000);
  });
}

qx.Class.define("qxl.testtapperdemo.test.Test09AsyncFunction", {
  extend: qx.dev.unit.TestCase,
  members: {
    "test01: async function": async function () {
      let value = await resolveAfter1Seconds();
      this.assertEquals(value,'resolved',"Timeout Resolved");
    },
    "test02: async function fail": async function () {
      let value = await resolveAfter1Seconds();
      this.assertEquals(value,'unresolved',"Timeout Resolved");
    },
    "test03: async function exception": async function () {
      let value = await resolveAfter1Seconds();
      unknownFunctionCall();
    }
  }
});
`test`\
