const argon2 = require('argon2')

exports.seed = function (knex) {
  // Deletes ALL existing entries
  return knex('tokens').del()
    .then(async function () {
      // Inserts seed entries
      const argonOpts = { type: argon2.argon2id }
      return knex('tokens').insert([
        { id: 1, uid: 1, token: await argon2.hash('mysecrettoken', argonOpts) },
        { id: 2, uid: 2, token: await argon2.hash('mysecrettoken', argonOpts) }
      ])
    })
}
