const models = require('../../models')

beforeAll(() => {
  const Objection = require('objection')
  const Knex = require('knex')
  const knexConfig = require('../../knexfile')

  Objection.Model.knex(Knex(knexConfig.development))
})

Object.values(models).forEach(model => {
  if (model.requiredGraph) {
    describe(model.name, () => {
      test('Queries successfully with requiredGraph', async () => {
        await model.query().withGraphFetched(model.requiredGraph)
      })

      if (model.prototype.activityPub) {
        test('ActivityPub conversion succeeds with requiredGraph', async () => {
          const rows = await model.query().withGraphFetched(model.requiredGraph)
          rows.forEach(x => {
            x.activityPub('https://example.com/')
          })
        })
      }

      if (model.prototype.activityPubActivity) {
        test('ActivityPub Activity conversion succeeds with requiredGraph', async () => {
          const rows = await model.query().withGraphFetched(model.requiredGraph)
          rows.forEach(x => {
            x.activityPubActivity('https://example.com/')
          })
        })
      }

      if (model.prototype.webfinger) {
        test('WebFinger conversion succeeds with requiredGraph', async () => {
          const rows = await model.query().withGraphFetched(model.requiredGraph)
          rows.forEach(x => {
            x.webfinger('https://example.com/')
          })
        })
      }
    })
  }
})

afterAll(() => {
  const Objection = require('objection')

  Objection.Model.knex().destroy()
  Objection.Model.knex(undefined)
})
