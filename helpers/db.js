const models = require('../models')
const argon2 = require('argon2')
const srs = require('secure-random-string')

async function createToken (user, app) {
  const plaintext = srs({ length: 256 })
  const hashed = await argon2.hash(plaintext, {
    type: argon2.argon2id
  })

  await models.Token.query().insert({
    uid: user.id,
    app: app ? app.id : null,
    token: hashed
  })

  return plaintext
}

module.exports = {
  createToken
}
