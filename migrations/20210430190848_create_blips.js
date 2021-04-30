
exports.up = function (knex) {
  return knex.schema
    .raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    .createTable('blips', (table) => {
      table.increments('id').primary()
      table.uuid('uuid').notNullable().defaultsTo(knex.raw('uuid_generate_v4()')).unique()
      table.timestamp('ts').notNullable().defaultsTo(knex.fn.now()).index()

      table.integer('reply_to_id').index()
        .references('id').inTable('blips')
        .onDelete('CASCADE').onUpdate('CASCADE')
      table.integer('uid').notNullable().index()
        .references('id').inTable('users')
        .onDelete('CASCADE').onUpdate('CASCADE')
      table.text('content')
    })
}

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('blips')
}
