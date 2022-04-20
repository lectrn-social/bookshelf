const Express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const redis = require('../lib/redis');
const mongoose = require('mongoose');
const { App, User, Token } = require('../lib/db');
const sha3 = require('../lib/sha3');
const random = require('../lib/random');
const validate = require('../lib/validate');

const EXISTING_SCOPES = ["me", "me:write", "me:private", "blips:write", "feed:home", "feed:home:private", "others", "others:private", "account:admin", "offline_access"]; // TODO: extend
const router = Express.Router();
const authorizeQuery = {
    response_type: {
        type: "string",
        required: true,
        enum: ['code'],
    },
    client_id: {
        type: "string",
        required: true,
        function: async (client_id, req) => {
            try {
                new mongoose.Types.ObjectId(client_id);
            } catch (e) {
                return "Invalid client_id";
            }

            let app = await App.findById(client_id).exec();
            if (!app) return "App not found";
            
            if (!req.target) req.target = {};
            req.target.app = app;
        },
    },
    redirect_uri: {
        type: "string",
        required: true,
        // TODO: Validate redirect_uri
    },
    scope: {
        type: "string",
        required: true,
        function: (x, req) => {
            let scopes = x.split(" ");
            if (scopes.find(x => !EXISTING_SCOPES.includes(x)))
                return "Supported values: " + EXISTING_SCOPES.join(", ");
            
            if (!req.target) req.target = {};
            req.target.scopes = scopes;
        },
    },
    code_challenge: {
        type: "string",
    },
    code_challenge_method: {
        type: "string",
        enum: ["S256"],
    },
};

router.get('/authorize',
    validate.middleware({
        query: authorizeQuery,
    }),
    async (req, res) => {
        res.render('authorize', req.target);
    }
);

router.post('/authorize',
    validate.middleware({
        query: authorizeQuery,
        body: {
            "#require": [
                ["password", "password_sha3"]
            ],
            type: {
                required: true,
                type: "string",
                enum: ["signin", "signup"],
            },
            username: {
                required: true,
                type: "string",
                function: async (username, req) => {
                    if (req.body.type == "signin") {
                        let user = await User.findOne({ username }).exec();
                        if (!user) return "User not found"

                        if (!req.target) req.target = {};
                        req.target.user = user;
                    }
                }
            },
            password: {
                type: "string",
            },
            password_sha3: {
                type: "string",
            },
        },
    }),
    async (req, res) => {
        let hash_sha3 = req.body.password_sha3 || sha3(req.body.password);

        if (req.body.type == "signin") {
            let passwordMatches = await bcrypt.compare(hash_sha3, req.target.user.authentication.password.hash);
            if (!passwordMatches) return res.status(400).json({error: "invalid_request", path: req.body.password ? "password" : "password_sha3", description: "Incorrect password"});
        } else {
            let passwordHash = await bcrypt.hash(hash_sha3, 12);

            if (!req.target) req.target = {};
            try {
                req.target.user = await (new User({
                    username: req.body.username,
                    authentication: {
                        password: {
                            hash: passwordHash
                        }
                    }
                }).save());
            } catch (e) {
                if (e.constructor.name === 'MongoServerError' && e.code == 11000) {
                    return res.status(400).json({error: "invalid_request", path: "username", reason: "Username taken"});
                } else {
                    throw e;
                }
            }
        }

        let code = (await random.bytes(3 ** 3)).toString('base64url');

        let rObj = { // TODO: EXPIRY
            challenge: req.body.code_challenge,
            challenge_method: req.body.code_challenge_method,
            user: req.target.user._id.toString(),
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
    }
);

router.options('/token', cors({ methods: ["POST"] }))
router.post('/token',
    cors(),
    validate.middleware({
        body: {
            grant_type: {
                type: "string",
                required: true,
                enum: ['authorization_code'],
            },
            code: {
                type: "string",
                required: true
            },
            client_id: authorizeQuery.client_id,
            redirect_uri: authorizeQuery.redirect_uri,
            code_verifier: {
                type: "string",
            }
        }
    }),
    async (req, res) => {
        let ir = (x, y="invalid_request") => res.status(400).json({error: y, description: x});

        let codeObj = await redis.hGetAll('bookshelf_code_' + req.body.code);
        if (!codeObj) return ir("Invalid code", "invalid_grant")
        if (codeObj.challenge) {
            if (!validate.doesExist(req.body.code_verifier)) return ir("Unspecified code_verifier")

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
            scopes,
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
    }
);

module.exports = {
    router
};