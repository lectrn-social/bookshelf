const Express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { User } = require('../lib/db');
const auth = require('../lib/auth');

const router = Express.Router();

async function parseUserAs(as, req, res, next) {
    if (req.method == "OPTIONS") return next();

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
                return res.status(400).json({ error: "invalid_request", field: ":user", description: "Invalid userid" });
            }
        }

        user = await User.findById(req.params[as]).exec();
    }

    if (!user) return res.status(404).json({ error: "invalid_request", path: ":user", description: "User not found" });

    if (!req.target) req.target = {};
    req.target[as] = user;

    next();
}

const parseUser = parseUserAs.bind({}, "user");

router.use(cors());
router.use(auth.forceAuth);

router.get('/:user',
    parseUser,
    auth.forceScope(auth.userScope),
    async (req, res) => {
        res.status(200).json(req.target.user); // TODO: datafilter
    }
);

router.patch('/:user',
    parseUser,
    auth.forceScope("me:write"),
    async (req, res) => {
        
    }
)

module.exports = {
    router,
    parseUserAs,
    parseUser,
};