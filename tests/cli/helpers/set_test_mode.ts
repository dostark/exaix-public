Deno.env.set("EXO_TEST_MODE", "1");
Deno.env.set("EXO_TEST_CLI_MODE", "1");

// Eagerly load the module at top level to avoid it being "loaded during the test" attribution
// We await it to ensure initialization completes before we unset the flags
await import("../../../src/cli/exoctl.ts");

// Clean up so we don't pollute other tests run in the same process
Deno.env.delete("EXO_TEST_MODE");
Deno.env.delete("EXO_TEST_CLI_MODE");
