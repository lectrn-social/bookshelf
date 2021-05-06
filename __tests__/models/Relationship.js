const models = require('../../models')
let john, jane, blip, joap, jaap

beforeAll(async () => {
  const Objection = require('objection')
  const Knex = require('knex')
  const knexConfig = require('../../knexfile')

  Objection.Model.knex(Knex(knexConfig.development))

  john = (await models.User.query().where('username', 'john').limit(1))[0]
  jane = (await models.User.query().where('username', 'jane').limit(1))[0]
  blip = (await models.Blip.query().withGraphFetched(models.Blip.requiredGraph).limit(1))[0]

  joap = john.activityPub('https://example.com')
  jaap = jane.activityPub('https://example.com')

  Objection.Model.knex().destroy()
  Objection.Model.knex(undefined)
})

describe('Generic tests', () => {
  test('Matches expected format', () => {
    {
      const x = new models.Relationship()
      x.type = 'Generic'
      x.actor_user = jane
      x.object_user = john

      const apa = x.activityPubActivity('https://example.com')
      expect(apa.actor).toEqual(jaap)
      expect(apa.object).toEqual(joap)
    }

    {
      const x = new models.Relationship()
      x.type = 'Generic'
      x.actor_user = jane
      x.object_url = joap.id

      const apa = x.activityPubActivity('https://example.com')
      expect(apa.actor).toEqual(jaap)
      expect(apa.object).toEqual(joap.id)
    }

    {
      const x = new models.Relationship()
      x.type = 'Generic'
      x.actor_url = jaap.id
      x.object_user = john

      const apa = x.activityPubActivity('https://example.com')
      expect(apa.actor).toEqual(jaap.id)
      expect(apa.object).toEqual(joap)
    }

    {
      const x = new models.Relationship()
      x.type = 'Generic'
      x.actor_url = jane
      x.object_blip = blip

      const apa = x.activityPubActivity('https://example.com')
      expect(apa.actor).toEqual(jaap)
      expect(apa.object).toEqual(blip.activityPub('https://example.com'))
    }

    {
      const bap = blip.activityPub('https://example.com')
      const x = new models.Relationship()
      x.type = 'Generic'
      x.actor_url = jane
      x.object_user = bap.id

      const apa = x.activityPubActivity('https://example.com')
      expect(apa.actor).toEqual(jaap)
      expect(apa.object).toEqual(bap.id)
    }
  })
})

describe('Follow', () => {
  describe('activityPubActivity', () => {
    test('Approved matches expected format', () => {
      const x = new models.Relationship()
      x.type = 'Follow'
      x.approved = true
      x.actor_user = jane
      x.object_user = john

      const apa = x.activityPubActivity('https://example.com')
      expect(apa.type).toBe('Accept')
      expect(apa.actor).toEqual(joap)
      expect(apa.object.type).toBe('Invite')
      expect(apa.object.actor).toEqual(jaap)
      expect(apa.object.object.type).toBe('Follow')
      expect(apa.object.object.actor).toEqual(jaap)
      expect(apa.object.object.object).toEqual(joap)
    })

    test('Not approved matches expected format', () => {
      const x = new models.Relationship()
      x.type = 'Follow'
      x.approved = false
      x.actor_user = jane
      x.object_user = john

      const apa = x.activityPubActivity('https://example.com')
      expect(apa.type).toBe('Invite')
      expect(apa.actor).toEqual(jaap)
      expect(apa.object.type).toBe('Follow')
      expect(apa.object.actor).toEqual(jaap)
      expect(apa.object.object).toEqual(joap)
    })
  })
})

describe('Reblip', () => {
  describe('activityPubActivity', () => {
    test('Remaps type', () => {
      const x = new models.Relationship()
      x.type = 'Reblip'
      x.actor_user = jane
      x.object_blip = blip

      const apa = x.activityPubActivity('https://example.com')
      expect(apa.type).toBe('Announce')
    })
  })
})
