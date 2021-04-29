
exports.up = function (knex) {
  return knex.schema
    .table('users', (table) => {
      table.unique('username')
    })
}

exports.down = function (knex) {
  return knex.schema
    .table('users', (table) => {
      table.dropUnique('username')
    })
}
