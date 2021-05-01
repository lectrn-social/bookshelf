const argon2 = require('argon2')

exports.seed = function (knex) {
  // Deletes ALL existing entries
  return knex('tokens').del()
    .then(async function () {
      const users = await knex('users').select('*')
      // Inserts seed entries
      const argonOpts = { type: argon2.argon2id }
      return knex('tokens').insert([
        { uid: users[0].id, token: await argon2.hash('mysecrettoken', argonOpts) },
        { uid: users[1].id, token: await argon2.hash('mysecrettoken', argonOpts) }
      ])
    })
}
