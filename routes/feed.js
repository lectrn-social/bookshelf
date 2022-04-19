const Express = require('express');
const { Blip, Post, Follow } = require("../lib/db");
const { parseUser } = require('./users');
const auth = require('../lib/auth');

const router = Express.Router({ mergeParams: true });

router.use(auth.forceAuth);
router.use(parseUser);

router.get('/user', auth.forceScope(
    auth.userScope,
    req => auth.userScope(req) + (req.query.privacy == "private" ? ":private" : ""),
), async (req, res) => {
    let count = parseInt(req.query.count || "20");
    let before = parseInt(req.query.before || Math.floor(Date.now() / 1000).toString());
    let privacy = req.query.privacy || "public";

    if (isNaN(count) || !isFinite(count) || count < 1 || count > 50) return res.status(400).json({ error: "invalid_count", error_description: "Invalid count. Must be a finite integer between 1 and 50 inclusive." });
    if (isNaN(before) || !isFinite(before) || isNaN(new Date(before * 1000))) return res.status(400).json({ error: "invalid_before", error_description: "Invalid before. Must be a unix epoch integer measured in seconds." });
    if (!["public", "private"].includes(privacy)) return res.status(400).json({ error: "invalid_privacy", error_description: "Invalid privacy. Supported values: public private" });

    before = new Date(before * 1000);

    let items = await Blip.find({
        createdAt: {$lt: before},
        owner: req.target.user,
        ...(privacy == "public" ?
        {
            audience: {
                audience:  "Public"
            }
        } : {})
    }).sort({ createdAt: 'desc' }).limit(count).exec();

    res.status(200).json({
        items, // TODO: datafilter
        nextBefore: items.length > 0 ? items[items.length - 1].createdAt : undefined
    });
});

router.get('/home', auth.forceScope(
    "feed:home",
    (req, res) => "feed:home" + (req.query.privacy == "private" ? ":private" : ""),
), async (req, res) => {
    if (req.target.user._id.toString() != req.auth.user.toString()) return res.status(403).json({ error: "unauthorized", error_description: "You may only access your own home feed." });

    let count = parseInt(req.query.count || "20");
    let before = parseInt(req.query.before || Math.floor(Date.now() / 1000).toString());
    let privacy = req.query.privacy || "public";

    if (isNaN(count) || !isFinite(count) || count < 1 || count > 50) return res.status(400).json({ error: "invalid_count", error_description: "Invalid count. Must be a finite integer between 1 and 50 inclusive." });
    if (isNaN(before) || !isFinite(before) || isNaN(new Date(before * 1000))) return res.status(400).json({ error: "invalid_before", error_description: "Invalid before. Must be a unix epoch integer measured in seconds." });
    if (!["public", "private"].includes(privacy)) return res.status(400).json({ error: "invalid_privacy", error_description: "Invalid privacy. Supported values: public private" });

    before = new Date(before * 1000)

    let items = [];

    let following = (await Follow.find({
        follower: req.target.user, pending: false
    }).exec())
        .map(x => x.followed);

    let mutuals = (await Follow.find({
        following: req.target.user,
        follower: { $in: following },
        pending: false
    }).exec())
        .map(x => x.follower);

    items.push(...(await Blip.find({
        createdAt: {$lt: before},
        owner: req.target.user,
        ...(privacy == "public" ?
        {
            audience: {
                audience:  "Public"
            }
        } : {})
    }).sort({ createdAt: 'desc' }).limit(count).exec()));

    items.push(...(await Blip.find({
        createdAt: {$lt: before},
        owner: {$in: following},
        audience: {
            audience: privacy == "public" ? "Public" : "Followers"
        }
    }).sort({ createdAt: 'desc' }).limit(count).exec()));

    if (privacy == "private") {
        items.push(...(await Blip.find({
            createdAt: {$lt: before},
            owner: {$in: mutuals},
            audience: {
                audience: "Mutuals"
            }
        }).sort({ createdAt: 'desc' }).limit(count).exec()));
    }

    items.sort((a,b) => b.createdAt - a.createdAt);
    items = items.slice(0, count);

    res.status(200).json({
        items, // TODO: datafilter
        nextBefore: items.length > 0 ? items[items.length - 1].createdAt : undefined
    });
});

module.exports = {
    router
}