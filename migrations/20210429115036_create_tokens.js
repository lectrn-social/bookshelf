
exports.up = function (knex) {
  return knex.schema
    .createTable('tokens', (table) => {
      table.increments('id').primary()
      table.integer('user').notNullable().references('id').inTable('users')
      table.integer('app')
      table.string('token').notNullable()
    })
}

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('tokens')
}
