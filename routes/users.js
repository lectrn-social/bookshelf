const Express = require('express');
const mongoose = require('mongoose');
const { User } = require('../lib/db');
const auth = require('../lib/auth');

const router = Express.Router();

async function parseUserAs(as, req, res, next) {
    let user;

    if (req.params[as].startsWith("@")) {
        user = await User.findOne({ username: req.params[as].slice(1) }).exec();
    } else if (req.params[as] == "me" && req.auth) {
        user = await User.findById(req.auth.user).exec();
    } else {
        if (req.params[as] != "me") {
            try {
                new mongoose.Types.ObjectId(req.params[as]);
            } catch (e) {
                return res.status(400).json({ error: "invalid_userid", error_description: "Invalid userid" });
            }
        }

        user = await User.findById(req.params[as]).exec();
    }

    if (!user) return res.status(404).json({ error: "user_not_found", error_description: "User not found" });

    if (!req.target) req.target = {};
    req.target.user = user;

    next();
}

const parseUser = parseUserAs.bind({}, "user");

router.use(auth.forceAuth);

router.get('/:user', parseUser, auth.forceScope(
    auth.userScope
), async (req, res) => {
    res.status(200).json(req.target.user); // TODO: datafilter
});

module.exports = {
    router,
    parseUserAs,
    parseUser,
};