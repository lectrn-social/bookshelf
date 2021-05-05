const models = require('../../models')
const vals = require('../../helpers/activitypub/vals')

beforeAll(() => {
  const Objection = require('objection')
  const Knex = require('knex')
  const knexConfig = require('../../knexfile')

  Objection.Model.knex(Knex(knexConfig.development))
})

Object.values(models).forEach(model => {
  if (model.prototype.activityPubActivity) {
    describe(model.name, () => {
      let rows

      beforeAll(async () => {
        rows = await model.query().withGraphFetched(model.requiredGraph)
        rows = rows.map(x => x.activityPubActivity('https://example.com/'))
      })

      test('Has a valid @context', async () => {
        rows.forEach(x => {
          if (Array.isArray(x['@context'])) {
            expect(x['@context']).toContain('https://www.w3.org/ns/activitystreams')
          } else {
            expect(x['@context']).toBe('https://www.w3.org/ns/activitystreams')
          }
        })
      })

      test('Has a valid type', async () => {
        rows.forEach(x => {
          expect(vals.activityTypes).toContain(x.type)
        })
      })

      test('Has a valid ID', async () => {
        rows.filter(x => x.id).forEach(x => {
          expect(() => new URL(x.id)).not.toThrow()
          expect(x.id).toMatch(/^https:\/\/example\.com\//)
        })
      })
    })
  }
})

afterAll(() => {
  const Objection = require('objection')

  Objection.Model.knex().destroy()
  Objection.Model.knex(undefined)
})
