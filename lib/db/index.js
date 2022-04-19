const deasync = require('deasync');
const mongoose = require('mongoose');

{
    let done = false;
    mongoose.connect(process.env.MONGODB_URI)
        .catch(e => {
            console.error("Failed to connect to database:", e);
            process.exit(1);
        })
        .finally(x => {done = true});
    deasync.loopWhile(() => !done);
}

module.exports = {
    App: require('./models/App'),
    Blip: require('./models/Blip'),
    Follow: require('./models/Follow'),
    Post: require('./models/Post'),
    Share: require('./models/Share'),
    Token: require('./models/Token'),
    User: require('./models/User'),
};