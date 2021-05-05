
exports.seed = function (knex) {
  // Deletes ALL existing entries
  return knex('blips').del()
    .then(async function () {
      const users = await knex('users').select('*')

      // Inserts seed entries
      await knex('blips').insert([
        { uid: users[1].id, uuid: '3affab31-5204-45eb-9a0c-3c5a5db3f6e3', content: 'Hello, world!' }
      ])

      const blips = await knex('blips').select('*')

      return knex('blips').insert([
        { uid: users[0].id, uuid: '64bdcab0-6f86-4ede-8eb4-96ee453005b6', reply_to_id: blips.slice(-1)[0].id, content: 'Hi there!' },
        { uid: users[0].id, uuid: '75f5f65b-f72e-4232-8adc-cdff4cb0d6ff', content: 'I\'m bored.' },
        { uid: users[0].id, uuid: 'b7235f50-0ea4-433c-848e-32e88442428e', content: 'Hello from the future!', ts: new Date(3000, 0) }
      ])
    })
}
