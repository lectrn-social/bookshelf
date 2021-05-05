const { db } = require('../../helpers')
const models = require('../../models')
const argon2 = require('argon2')

beforeAll(() => {
  const Objection = require('objection')
  const Knex = require('knex')
  const knexConfig = require('../../knexfile')

  Objection.Model.knex(Knex(knexConfig.development))
})

describe('createToken', () => {
  test('Creates valid token', async () => {
    const john = (await models.User.query()
      .where('username', 'john')
      .limit(1))[0]

    const plaintext = await db.createToken(john)
    const b64regex = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2}==|[A-Za-z0-9_-]{3}=)?$/

    expect(b64regex.test(plaintext)).toBe(true)
    expect(plaintext.length).toBe(256)

    const tokens = await models.Token.query()
      .where('uid', john.id)

    let foundMatchingToken = false

    for (const token of tokens) {
      if (await argon2.verify(token.token, plaintext, { type: argon2.argon2id })) {
        foundMatchingToken = true
        break
      }
    }

    expect(foundMatchingToken).toBe(true)
  })
})

afterAll(() => {
  const Objection = require('objection')

  Objection.Model.knex().destroy()
  Objection.Model.knex(undefined)
})
