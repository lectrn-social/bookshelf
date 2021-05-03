
exports.up = function (knex) {
  return knex.schema
    .createTable('relationships', (table) => {
      table.increments('id').primary()
      table.timestamp('ts').notNullable().defaultsTo(knex.fn.now()).index()
      table.string('type').notNullable().index()

      table.integer('actor_user_id').index()
        .references('id').inTable('users')
        .onDelete('CASCADE').onUpdate('CASCADE')
      table.text('actor_url').index()

      table.integer('object_user_id').index()
        .references('id').inTable('users')
        .onDelete('CASCADE').onUpdate('CASCADE')
      table.integer('object_blip_id').index()
        .references('id').inTable('blips')
        .onDelete('CASCADE').onUpdate('CASCADE')
      table.text('object_url').index()

      table.boolean('approved').defaultsTo(true).index()
      table.timestamp('approve_ts').defaultsTo(knex.fn.now())
    })
}

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('relationships')
}
