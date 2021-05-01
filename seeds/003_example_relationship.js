
exports.seed = function (knex) {
  // Deletes ALL existing entries
  return knex('relationships').del()
    .then(async function () {
      const users = await knex('users').select('*')

      // Inserts seed entries
      return knex('relationships').insert([
        { type: 'Follow', actor_user_id: users[0].id, object_user_id: users[1].id, approved: true, approve_ts: new Date() },
        { type: 'Follow', actor_user_id: users[1].id, object_user_id: users[0].id, approved: true, approve_ts: new Date() },
        { type: 'Follow', actor_user_id: users[1].id, object_url: 'https://lectrn.example.com/@alice', approved: true, approve_ts: new Date() },
        { type: 'Follow', actor_url: 'https://lectrn.example.com/@bob', object_user_id: users[0].id, approved: true, approve_ts: new Date() }
      ])
    })
}
