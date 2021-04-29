
exports.up = function (knex) {
  return knex.schema
    .table('tokens', (table) => {
      table.index('uid')
    })
}

exports.down = function (knex) {
  return knex.schema
    .table('tokens', (table) => {
      table.dropIndex('uid')
    })
}
