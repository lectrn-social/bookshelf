const Express = require('express');
const mongoose = require('mongoose');
const { Blip } = require("../lib/db");
const { parseUser } = require('./users');
const auth = require('../lib/auth');
const validate = require('../lib/validate');

const router = Express.Router({ mergeParams: true });

async function parseBlip(req, res, next) {
    try {
        new mongoose.Types.ObjectId(req.params.blip);
    } catch (e) {
        return res.status(400).json({ error: "invalid_request", path: ":blipid", description: "Invalid blipid" });
    }

    let blip = await Blip.findById(req.params.blip).exec();

    if (!blip) return res.status(404).json({ error: "invalid_request", path: ":blipid", description: "Blip not found" });

    if (!req.target) req.target = {};
    
    if (req.target.user) {
        if (blip.owner != req.target.user) {
            return res.status(404).json({ error: "invalid_request", path: ":blipid", description: "Blip not found" });
        }
    }

    req.target.blip = blip;

    next();
}

router.use(auth.forceAuth);
router.use(parseUser);

router.get('/',
    auth.forceScope(
        auth.userScope,
        req => auth.userScope(req) + (req.query.privacy == "private" ? ":private" : ""),
    ),
    async (req, res) => {
        let count = parseInt(req.query.count || "20");
        let from = parseInt(req.query.from || "0");
        let privacy = req.query.privacy || "public";

        if (isNaN(count) || !isFinite(count) || count < 1 || count > 50) return res.status(400).json({ error: "invalid_count", error_description: "Invalid count. Must be a finite integer between 1 and 50 inclusive." });
        if (isNaN(from) || !isFinite(from)) return res.status(400).json({ error: "invalid_from", error_description: "Invalid from. Must be a finite integer." });
        if (!["public", "private"].includes(privacy)) return res.status(400).json({ error: "invalid_privacy", error_description: "Invalid privacy. Supported values: public private" });

        let blips = await Blip.find({
            owner: req.target.user._id,
            ...(privacy == "public" ?
            {
                audience: {
                    audience:  "Public"
                }
            } : {})
        })
            .sort({ createdAt: from < 0 ? 'asc' : 'desc' })
            // my brain just about exploded because of this shit
            .skip(from < 0 ? Math.abs(from) - Math.min(count, Math.abs(from)) : from)
            .limit(count)
            .exec();

        if (from < 0) blips.reverse();

        res.status(200).json(blips); // TODO: datafilter
    }
);

router.post('/',
    auth.forceScope("blips:write"),
    validate.middleware({
        body: {
            content: {
                required: true,
                type: "string",
            },
            contentWarning: {
                type: "string",
            },
            audience: {
                enum: ["Public", "Followers", "Mutuals", "Self"],
            },
        },
    }),
    async (req, res) => {
        let blip = await new Blip({
            owner: req.target.user._id,
            contentWarning: req.body.contentWarning,
            content: req.body.content,
            audience: {
                audience: req.body.audience || req.target.user.privacy.blip.defaultAudience,
                isDefault: !req.body.audience,
            },
        }).save();

        res.status(200).json(blip); // TODO: datafilter
    }
)

router.get('/:blip',
    parseBlip,
    auth.forceScope(
        req => auth.userScope(req) + (req.target.blip.audience.audience != "Public" ? ":private" : "")
    ),
    async (req, res) => {
        res.status(200).json(req.target.blip); // TODO: datafilter
    }
);

module.exports = {
    router,
    parseBlip
};