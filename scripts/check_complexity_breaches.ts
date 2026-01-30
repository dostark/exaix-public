#!/usr/bin/env -S deno run --allow-read

/**
 * Check complexity breaches from JSON report
 */

const txt = await Deno.readTextFile("complexity.json");
const obj = JSON.parse(txt);
const files = obj.exceeding?.files?.length || 0;
const fns = obj.exceeding?.functions?.length || 0;
console.log(`Complexity breaches: files=${files}, functions=${fns}`);
if (files > 0 || fns > 0) {
  Deno.exit(1);
}
