function pathResolve(obj, path) {
    let tokens = path.split('.');
    let x = obj;
    for (let token of tokens) {
        x = x[token];
    }
    return x;
}

function doesExist(x) {
    return !(
        x === undefined ||
        x === null ||
        (
            typeof x === "string" &&
            x.trim().length === 0
        )
    )
}

/**
 * 
 * @param {object} obj Object to validate
 * @param {*} rules Validation rules
 * @returns {bool|object} Returns false if validation is OK, returns an object if it failed.
 */
async function validate(obj, rules, req) {
    for (let [path, rule] of Object.entries(rules)) {
        if (path == "#require") {
            for (let group of rule) {
                if (group.every(x => !doesExist(pathResolve(obj, x)))) return {error: "invalid_request", paths: group, description: "One of paths must exist"}
            }
            continue;
        }

        let x = pathResolve(obj, path);
        for (let [name, value] of Object.entries(rule)) {
            if (name === "required" && value && !doesExist(x)) return {error: "invalid_request", path, description: "Missing field"};
            if (name === "function") {
                let description = await value(x, req);
                if (description) {
                    return {error: "invalid_request", path, description}
                }
            }
            if (name === "enum" && doesExist(x) && !value.includes(x)) return {error: "invalid_request", path, description: "Supported values: " + rule.enum.join(", ")};
            if (name === "type" && doesExist(x) && !(Array.isArray(value) ? value : [value]).some(y => typeof x == y)) return {error: "invalid_request", path, description: "Must be of type " + (Array.isArray(value) ? value : [value]).join(" or ")};
        }
    }
    return false;
}

async function response(res, obj, rules, req) {
    let result = await validate(obj, rules, req);
    if (result) res.status(400).json(result);
    return !!result;
}

function middleware(ruleSet) {
    return async function _middleware(req, res, next) {
        for (let [path, rules] of Object.entries(ruleSet)) {
            if (await response(res, pathResolve(req, path), rules, req)) return;
        }
        next();
    }
}

module.exports = {
    doesExist,
    validate,
    response,
    middleware
};