//src/index.js
const { connectToDatabase } = require('./database');
const eventListener = require('./eventListener');

async function start() {
    await connectToDatabase();
    await eventListener.startPolling('SPNWZ5V2TPWGQGVDR6T7B6RQ4XMGZ4PXTEE0VQ0S', 'mojo');
}

start();