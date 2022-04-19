const deasync = require('deasync');
const { createClient } = require('redis');

let done = false;
const client = createClient({ url: process.env.REDIS_URI });
client.on('error', err => {
    console.error("A Redis error has occurred:", err);
});
client.connect()
    .catch((err) => {
        console.error("Failed to connect to Redis:", err);
        process.exit(1);
    })
    .finally(() => {done = true});
deasync.loopWhile(() => !done);

module.exports = client;