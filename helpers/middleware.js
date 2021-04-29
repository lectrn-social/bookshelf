const routing = require('./routing')
const models = require('../models')
const argon2 = require('argon2')

function allowAllCors (req, res, next) {
  routing.allowAllCors(res)
  next()
}

async function getResourceForPath (req, res, next) {
  req.resource = await routing.getResourceForPath(req.path)
  next()
}

async function getCurrentUser (req, res, next) {
  if (typeof req.session.uid !== 'number' ||
      typeof req.session.token !== 'string') {
    return next()
  }

  const query = await models.Token.query()
    .where('uid', req.session.uid)
    .withGraphFetched('user')

  for (let token of query) {
    if (await argon2.verify(token.token, req.session.token, { type: argon2.argon2id })) {
      req.user = token.user
      break
    }
  }

  next()
}

module.exports = {
  allowAllCors,
  getResourceForPath,
  getCurrentUser
}
