const argon2 = require('argon2')

exports.seed = function (knex) {
  // Deletes ALL existing entries
  return knex('users').del()
    .then(async function () {
      // Inserts seed entries
      const argonOpts = { type: argon2.argon2id }
      return knex('users').insert([
        { id: 1, username: 'john', password: await argon2.hash('password', argonOpts), name: 'John Doe', summary: 'This is an example profile.' },
        { id: 2, username: 'jane', password: await argon2.hash('wordpass', argonOpts), name: 'Jane Doe' }
      ])
    })
}
