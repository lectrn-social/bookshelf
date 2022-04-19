const sha3 = require('../lib/sha3');
const { Token } = require('../lib/db');

async function parseAuth(req, res, next) {
    let authorization = req.headers.authorization;
    if (!authorization) return next();
    if (!authorization.startsWith("Bearer ")) return next();

    let token = authorization.slice("Bearer ".length);
    let tokenHash = sha3(token);
    
    let tokenObj = await Token.findOne({ accessToken: tokenHash }).exec();
    if (!tokenObj) return next();
    if (tokenObj.expiresAt < new Date()) return next();

    req.auth = {
        user: tokenObj.user,
        app: tokenObj.app,
        scopes: tokenObj.scopes
    }

    next();
}

function forceAuth(req, res, next) {
    if (!req.auth) return res.status(401).json({ error: "unauthorized", error_description: "Unauthorized" });

    next();
}

function forceScope(...scopes) {
    return function _forceScope(req, res, next) {
        for (let scope of scopes) {
            if (!req.auth.scopes.includes(typeof scope == "function" ? scope(req) : scope)) 
                return res.status(401).json({ error: "missing_scope", error_description: "Missing scope " + scope });
        }
        
        next();
    }
}

function userScope(req) {
    return req.target.user._id.toString() == req.auth.user.toString() ? "me" : "others";
}

module.exports = {
    parseAuth,
    forceAuth,
    forceScope,
    userScope
}