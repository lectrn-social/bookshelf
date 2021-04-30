
exports.seed = function (knex) {
  // Deletes ALL existing entries
  return knex('blips').del()
    .then(async function () {
      var users = await knex('users').select('*')

      // Inserts seed entries
      await knex('blips').insert([
        { uid: users[1].id, content: 'Hello, world!' }
      ])

      var blips = await knex('blips').select('*')

      return knex('blips').insert([
        { uid: users[0].id, reply_to_id: blips.slice(-1)[0].id, content: 'Hi there!' },
        { uid: users[0].id, content: 'I\'m bored.' },
        { uid: users[0].id, content: 'Hello from the future!', ts: new Date(3000, 0) }
      ])
    })
}
