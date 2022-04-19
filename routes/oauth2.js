const Express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const redis = require('../lib/redis');
const mongoose = require('mongoose');
const { App, User, Token } = require('../lib/db');
const sha3 = require('../lib/sha3');
const random = require('../lib/random');

const EXISTING_SCOPES = ["me", "me:write", "me:private", "blips:write", "feed:home", "feed:home:private", "others", "others:private", "account:admin", "offline_access"]; // TODO: extend
const router = Express.Router();

async function authorizeVerify(req, res) {
    if (req.query.response_type !== 'code') return res.status(400).json({error: "invalid_request", error_description: "Invalid response_type. Supported values: code"});
    if (!req.query.client_id) return res.status(400).json({error: "invalid_request", error_description: "Unspecified client_id"});
    if (!req.query.redirect_uri) return res.status(400).json({error: "invalid_request", error_description: "Unspecified redirect_uri"});
    if (!req.query.scope || req.query.scope.trim().length == 0) return res.status(400).json({error: "invalid_request", error_description: "Unspecified scope"});
    if (req.query.code_challenge && req.query.code_challenge_method && req.query.code_challenge_method != "S256") return res.status(400).json({error: "invalid_request", error_description: "Invalid code_challenge_method. Supported values: S256"});

    let scopes = req.query.scope.split(' ');

    let badScope = scopes.find(x => !EXISTING_SCOPES.includes(x));
    if (badScope) return res.status(400).json({error: "invalid_request", error_description: "Invalid scope. Supported values: " + EXISTING_SCOPES.join(' ')});

    try {
        new mongoose.Types.ObjectId(req.query.client_id);
    } catch (e) {
        return res.status(400).json({error: "invalid_request", error_description: "Invalid client_id"});
    }

    let app = await App.findById(req.query.client_id).exec();
    if (!app) return res.status(400).json({error: "invalid_request", error_description: "App not found"});

    // TODO: Verify that the app can actually request these scopes
    // TODO: Validate redirect_uri

    return {scopes, app}
}

router.get('/authorize', async (req, res) => {
    let verify = await authorizeVerify(req, res);
    if (!verify) return;
    let {scopes, app} = verify;

    res.render('authorize', { scopes, app });
});

router.post('/authorize', async (req, res) => {
    let verify = await authorizeVerify(req, res);
    if (!verify) return;

    if (!req.body) return res.status(400).json({error: "invalid_request", error_description: "Unspecified body"});
    if (!req.body.username) return res.status(400).json({error: "invalid_request", error_description: "Unspecified username"});
    if (!req.body.password_sha3 && !req.body.password) return res.status(400).json({error: "invalid_request", error_description: "Unspecified password"});

    let user = await User.findOne({ username: req.body.username }).exec();
    if (!user) return res.status(400).json({error: "user_not_found"});

    let hash_sha3 = req.body.password_sha3 || sha3(req.body.password);
    let passwordMatches = await bcrypt.compare(hash_sha3, user.authentication.password.hash);
    if (!passwordMatches) return res.status(400).json({error: "bad_password"});

    let code = (await random.bytes(3 ** 3)).toString('base64url');

    let rObj = { // TODO: EXPIRY
        challenge: req.body.code_challenge,
        challenge_method: req.body.code_challenge_method,
        user: user._id.toString(),
        redirect_uri: req.query.redirect_uri,
        client_id: req.query.client_id,
        scopes: req.query.scope
    };

    rObj = Object.fromEntries(Object.entries(rObj).filter(([k, v]) => v));

    await redis.HSET('bookshelf_code_' + code, rObj);

    let redirect;
    try {
        redirect = new URL(req.query.redirect_uri);
    } catch (e) {
        return res.status(400).json({error: "invalid_request", error_description: "Invalid redirect_uri"});
    }

    if (req.query.state) redirect.searchParams.set('state', req.query.state);
    redirect.searchParams.set('code', code);

    if (req.accepts('json') && !req.accepts('html')) {
        res.json({
            code,
            redirect: redirect.toString(),
        });
    } else {
        res.redirect(redirect.toString());
    }
});

router.options('/token', cors({ methods: ["POST"] }))
router.post('/token', cors(), async (req, res) => {
    let ir = (x, y="invalid_request") => res.status(400).json({error: y, error_description: x});

    if (!req.body.grant_type) return ir("Unspecified grant_type. Supported values: authorization_code");
    if (req.body.grant_type != "authorization_code") return ir("Unsupported grant_type. Supported values: authorization_code", "unsupported_grant_type");
    if (!req.body.code) return ir("Unspecified code")

    let codeObj = await redis.hGetAll('bookshelf_code_' + req.body.code);
    if (!codeObj) return ir("Invalid code", "invalid_grant")
    if (codeObj.challenge) {
        if (!req.body.code_verifier) return ir("Unspecified code_verifier")

        let code_challenge = sha256(Buffer.from(req.body.code_verifier, 'ascii')).toString('base64url');
        if (codeObj.challenge != code_challenge) return ir("Incorrect code_verifier", "invalid_grant")
    }

    if (req.body.redirect_uri != codeObj.redirect_uri) return ir("Invalid redirect_uri", "invalid_grant")
    if (req.body.client_id != codeObj.client_id) return ir("Invalid client_id", "invalid_grant")

    let scopes = codeObj.scopes.split(' ');

    let access_token = (await random.bytes(3 ** 5)).toString("base64url");
    let refresh_token = scopes.includes("offline_access") ? (await random.bytes(3 ** 5)).toString("base64url") : undefined;

    let createdAt = new Date();
    let expiresAt = new Date(createdAt);
    expiresAt.setHours(expiresAt.getHours() + 1);

    let token = new Token({
        app: req.body.client_id,
        user: codeObj.user,
        accessToken: sha3(access_token),
        refreshToken: refresh_token ? sha3(refresh_token) : undefined,
        scopes: codeObj.scopes,
        createdAt,
        expiresAt
    });

    await token.save();

    await redis.del('bookshelf_code_' + req.body.code);

    res.status(200).json({
        access_token,
        token_type: "Bearer",
        expires_in: (expiresAt - createdAt) / 1000,
        refresh_token,
        scope: scopes.join(' '),
        user: codeObj.user,
    });
});

module.exports = {
    router
};