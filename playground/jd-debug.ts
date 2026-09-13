#!/usr/bin/env bun
import { $, spawnSync } from "bun";
import color from 'colors/safe.js';
import { JsonDiff } from '../lib/JsonDiff';

// This script offers a convenient way to experiment with json-diff and provides some helpful examples to get you started
// Also, if it has focus in VS Code, you can debug json-diff via the "Debug File" launch config.
// Simply set your break points and click the debug button.

// Example 1:

// const diffCmd = spawnSync({
//   cmd: ["bun", "bin/json-diff.js", "--full", "--raw-json", "playground/json/nestedArray1.json", "playground/json/nestedArray2.json"],
//   stdout: "inherit",
//   stderr: "inherit",
// });


// Example 2:
// Same as above, but uses bun shell

// await $`json-diff --full --raw-json playground/json/nestedArray1.json playground/json/nestedArray2.json`;
// await $`json-diff -jd playground/json/fileA.json playground/json/fileB.json`;


// // Example 3:
// // Or instead of using the CLI, simply create an instance of the JsonDiff class

let objA, objB;
let options = {}, result;
const jd = new JsonDiff(options);

objA = await Bun.file(import.meta.dir + "/json/fileA.json").json();
objB = await Bun.file(import.meta.dir + "/json/fileB.json").json();

jd.options = { full: false };
console.log(`\n${color.grey("Example 1:")}\n`);
console.log(`options: ${JSON.stringify(jd.options)}\n`);
result = await jd.exec(objA, objB);

jd.options = { debug: true };
console.log(`\n\n${color.grey("Example 2:")}\n`);
console.log(`options: ${JSON.stringify(jd.options)}`);
result = await jd.exec(objA, objB);

jd.options = { full: true };
console.log(`\n\n${color.grey("Example 3:")}\n`);
console.log(`options: ${JSON.stringify(jd.options)}\n`);
result = await jd.exec(objA, objB);

objA = await Bun.file(import.meta.dir + "/json/nestedArray1.json").json();
objB = await Bun.file(import.meta.dir + "/json/nestedArray2.json").json();


jd.options = { debug: true, raw: false, full: false, silent: false, color: true };
console.log(`\n\n${color.grey("Example 4a:")}\n`);
console.log(`options: ${JSON.stringify(jd.options)}`);
result = await jd.exec(objA[0], objB[0]); // debug only computes for the top-most array, in this case, both objA and objB are array containing a single object, which isn't useful 

// The silent option only exists for the JsonDiff class (not the CLI) and allows us to limit the output to just the fuzzy matches pivot table 
jd.options = { debug: true, raw: false, full: false, silent: true, color: true };
console.log(`\n\n${color.grey("Example 4b:")} ${color.blue("The silent option only exists for the JsonDiff class (not the CLI) and allows us to limit the output to just the fuzzy matches pivot table)")}\n`);
console.log(`options: ${JSON.stringify(jd.options)}`);
result = await jd.exec(objA[0], objB[0]); // debug only computes for the top-most array, in this case, both objA and objB are array containing a single object, which isn't useful 

// The silent option, though, was really added for use cases where json-diff is being used programatically (as opposed to one-off diffs) 
jd.options = { debug: false, raw: false, full: false, silent: true };
console.log(`${color.grey("Example 4c:")} ${color.blue("The silent option, though, is really for cases where json-diff is being used programatically (as opposed to one-off diffs)")}\n`);
console.log(`options: ${JSON.stringify(jd.options)}\n`);
result = await jd.exec(objA[0], objB[0]); // debug only computes for the top-most array, in this case, both objA and objB are array containing a single object, which isn't useful 
console.log(`result: ${JSON.stringify(result)}\n`);

objA = await Bun.file(import.meta.dir + "/json/big_a.json").json();
objB = await Bun.file(import.meta.dir + "/json/big_b.json").json();

jd.options = { debug: true };
console.log(`\n${color.grey("Example 5:")}\n`);
console.log(`options: ${JSON.stringify(jd.options)}`);
result = await jd.exec(objA, objB);

objA = await Bun.file(import.meta.dir + "/json/precisionA.json").json();
objB = await Bun.file(import.meta.dir + "/json/precisionB.json").json();

// The debug option doesn't do anything here because all of the values in the array are scalars
jd.options = { debug: true, precision: 3 };
console.log(`\n\n${color.grey("Example 6:")} ${color.blue("The debug option doesn't do anything here because all of the values in the array are scalars")}\n`);
console.log(`options: ${JSON.stringify(jd.options)}`);
result = await jd.exec(objA, objB);
