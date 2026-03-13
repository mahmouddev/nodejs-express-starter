console.log("1 - Start");

setTimeout(() => console.log("2 - setTimeout"), 0);

Promise.resolve().then(() => console.log("3 - Promise"));

process.nextTick(() => console.log("4 - nextTick"));

setImmediate(() => console.log("5 - setImmediate"));

console.log("6 - End");

// Write a comment with your predicted order BEFORE running it

// a) Promise.all — run 3 async tasks in parallel, wait for ALL
Promise.all([
    Promise.resolve(1),
    Promise.resolve(2),
    Promise.resolve(3)
]).then(results => console.log(results));

// b) Promise.allSettled — run 3 tasks, get results even if some fail
Promise.allSettled([
    Promise.resolve(1),
    Promise.reject("error"),
    Promise.resolve(3)
]).then(results => console.log(results));

// c) Promise.race — return the first to complete
Promise.race([
    Promise.resolve(1),
    Promise.resolve(2),
    Promise.resolve(3)
]).then(results => console.log(results));

// d) Promise.any — return the first to SUCCEED (ignores rejections)
Promise.any([
    Promise.reject("error 1"),
    Promise.reject("error 2"),
    Promise.resolve(3)
]).then(results => console.log(results));


// Write a function called delay(ms) that returns a Promise
// that resolves after ms milliseconds
// Then use it: await delay(1000)
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
delay(1000).then(() => console.log("1 second passed"));