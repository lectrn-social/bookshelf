const { factory } = require('../../../helpers/activitypub')

describe('_collectionPointer', () => {
  test('Has a valid @context', () => {
    const x = factory._collectionPointer('Collection', 'https://example.com/', '/users', 2)

    if (Array.isArray(x['@context'])) {
      expect(x['@context']).toContain('https://www.w3.org/ns/activitystreams')
    } else {
      expect(x['@context']).toBe('https://www.w3.org/ns/activitystreams')
    }
  })

  test('Has a correct ID', () => {
    const x = factory._collectionPointer('Collection', 'https://example.com/', '/users', 2)
    expect(x.id).toBe('https://example.com/users')
  })

  test('Calculates pages correctly', () => {
    const x = factory._collectionPointer('Collection', 'https://example.com/', '/users', 2)
    expect(x.first).toBe('https://example.com/users?page=0')
    expect(x.last).toBe('https://example.com/users?page=0')

    const y = factory._collectionPointer('Collection', 'https://example.com/', '/users', 10)
    expect(y.first).toBe('https://example.com/users?page=0')
    expect(y.last).toBe('https://example.com/users?page=0')

    const z = factory._collectionPointer('Collection', 'https://example.com/', '/users', 11)
    expect(z.first).toBe('https://example.com/users?page=0')
    expect(z.last).toBe('https://example.com/users?page=1')

    const a = factory._collectionPointer('Collection', 'https://example.com/', '/users', 11, 5)
    expect(a.first).toBe('https://example.com/users?count=5&page=0')
    expect(a.last).toBe('https://example.com/users?count=5&page=2')
  })
})

describe('_collectionPage', () => {
  test('Has a valid @context', () => {
    const x = factory._collectionPage('CollectionPage', 'https://example.com/', '/users', 0, [], { query: { page: 0 } })

    if (Array.isArray(x['@context'])) {
      expect(x['@context']).toContain('https://www.w3.org/ns/activitystreams')
    } else {
      expect(x['@context']).toBe('https://www.w3.org/ns/activitystreams')
    }
  })

  test('Has a correct ID & partOf', () => {
    const x = factory._collectionPage('CollectionPage', 'https://example.com/', '/users', 0, [], { query: { page: 0 } })
    expect(x.id).toBe('https://example.com/users?page=0')
    expect(x.partOf).toBe('https://example.com/users')
  })

  test('Has a correct ID & partOf without req', () => {
    const x = factory._collectionPage('CollectionPage', 'https://example.com/', '/users', 0, [])
    expect(x.id).toBe('https://example.com/users?page=0')
    expect(x.partOf).toBe('https://example.com/users')
  })

  test('Calculates next & prev correctly', () => {
    const x = factory._collectionPage('CollectionPage', 'https://example.com/', '/users', 0, [], { query: { page: 0 } })
    expect(x.prev).toBeUndefined()
    expect(x.next).toBe('https://example.com/users?page=1')

    const y = factory._collectionPage('CollectionPage', 'https://example.com/', '/users', 1, [], { query: { page: 1 } })
    expect(y.prev).toBe('https://example.com/users?page=0')
    expect(y.next).toBe('https://example.com/users?page=2')

    const z = factory._collectionPage('CollectionPage', 'https://example.com/', '/users', 2, [], { query: { page: 2, count: 5 } })
    expect(z.prev).toBe('https://example.com/users?page=1&count=5')
    expect(z.next).toBe('https://example.com/users?page=3&count=5')
  })
})

describe('createObj', () => {
  test('Has a valid @context and type', () => {
    const x = factory.createObj({})

    if (Array.isArray(x['@context'])) {
      expect(x['@context']).toContain('https://www.w3.org/ns/activitystreams')
    } else {
      expect(x['@context']).toBe('https://www.w3.org/ns/activitystreams')
    }

    expect(x.type).toBe('Create')
  })

  test('Copies everything', () => {
    const actor = {
      type: 'Person',
      preferredUsername: 'john'
    }

    const obj = {
      id: 'https://example.com/posts/1',
      to: 'https://www.w3.org/ns/activitystreams#Public',
      bto: 'https://example.com/@jane',
      cc: 'https://example.com/groups/johnsgroup',
      bcc: 'https://example.com/@admin',
      published: new Date().toISOString()
    }

    const act = factory.createObj(obj, actor)

    expect(act.id).toBe('https://example.com/posts/1/activity')
    expect(act.to).toBe(obj.to)
    expect(act.bto).toBe(obj.bto)
    expect(act.cc).toBe(obj.cc)
    expect(act.bcc).toBe(obj.bcc)
    expect(act.published).toBe(obj.published)
    expect(act.actor).toBe(actor)
    expect(act.object).toBe(obj)
  })
})
