
exports.seed = function (knex) {
  // Deletes ALL existing entries
  return knex('relationships').del()
    .then(async function () {
      const users = await knex('users').select('*')
      const blips = await knex('blips').select('*').whereIn('uuid', ['3affab31-5204-45eb-9a0c-3c5a5db3f6e3', '64bdcab0-6f86-4ede-8eb4-96ee453005b6'])

      // Inserts seed entries
      return knex('relationships').insert([
        { type: 'Follow', actor_user_id: users[0].id, object_user_id: users[1].id },
        { type: 'Follow', actor_user_id: users[1].id, object_user_id: users[0].id },
        { type: 'Follow', actor_user_id: users[1].id, object_url: 'https://lectrn.example.com/@alice' },
        { type: 'Follow', actor_url: 'https://lectrn.example.com/@bob', object_user_id: users[0].id },

        { type: 'Like', actor_user_id: users[0].id, object_blip_id: blips[0].id },
        { type: 'Like', actor_user_id: users[1].id, object_blip_id: blips[1].id },

        { type: 'Reblip', actor_user_id: users[0].id, object_blip_id: blips[0] }.id
      ])
    })
}
