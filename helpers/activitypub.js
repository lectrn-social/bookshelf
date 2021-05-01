function calculateCollectionURLProps (path, pageCount, total) {
  const url = new URL(path, process.env.BASE_URL)

  if (pageCount !== 10) {
    url.searchParams.set('count', pageCount)
  }

  const firstPage = 0
  const lastPage = Math.max(0, Math.ceil(total / pageCount) - 1)

  return {
    id: url.href,
    first: (url.searchParams.set('page', firstPage), url.href),
    last: (url.searchParams.set('page', lastPage), url.href)
  }
}

function calculateCollectionPageURLProps (path, currentPage, req) {
  const url = new URL(path, process.env.BASE_URL)

  if (req) {
    Object.entries(req.query).forEach(x => {
      url.searchParams.set(...x)
    })
  }

  return {
    id: url.href,
    next: (url.searchParams.set('page', currentPage + 1), url.href),
    prev: currentPage !== 0 ? (url.searchParams.set('page', currentPage - 1), url.href) : undefined,
    partOf: (url.searchParams.delete('page'), url.href)
  }
}

const vals = {
  activityTypes: ['Accept', 'Add', 'Announce', 'Arrive', 'Block', 'Create', 'Delete', 'Dislike', 'Flag', 'Follow', 'Ignore', 'Invite', 'Join', 'Leave', 'Like', 'Listen', 'Move', 'Offer', 'Question', 'Reject', 'Read', 'Remove', 'TentativeReject', 'TentativeAccept', 'Travel', 'Undo', 'Update', 'View'],
  objectTypes: ['Article', 'Audio', 'Document', 'Event', 'Image', 'Note', 'Page', 'Place', 'Profile', 'Relationship', 'Tombstone', 'Video'],
  linkTypes: ['Mention']
}

const factory = (function () {
  function _collectionPointer (type, path, total, pageCount = 10) {
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type,
      totalItems: total,
      ...calculateCollectionURLProps(path, pageCount, total) // id, first, last
    }
  }

  function _collectionPage (type, path, currentPage, items, req) {
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: type,
      ...calculateCollectionPageURLProps(path, currentPage, req), // id, next, prev, partOf
      orderedItems: items
    }
  }

  function createObj (object, actor) {
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Create',
      id: object.id + '/activity',
      actor,
      to: object.to,
      bto: object.bto,
      cc: object.cc,
      bcc: object.bcc,
      published: object.published,
      object
    }
  }

  return {
    _collectionPointer,
    orderedCollectionPointer: _collectionPointer.bind(this, 'OrderedCollection'),
    collectionPointer: _collectionPointer.bind(this, 'Collection'),

    _collectionPage,
    orderedCollectionPage: _collectionPage.bind(this, 'OrderedCollectionPage'),
    collectionPage: _collectionPage.bind(this, 'CollectionPage'),

    createObj
  }
})()

const middleware = (function () {
  async function _collection (type, query, asActivity, countQuery, req, res) {
    const total = Object.values((await (countQuery || query.clone()).count())[0])[0]
    const pageCount = (req.query.count || req.query.limit) ? parseInt(req.query.count || req.query.limit) : 10

    if (isNaN(pageCount) || !isFinite(pageCount) || pageCount < 0) {
      return res.status(400).send()
    }

    if (typeof req.query.page === 'string') {
      const currentPage = parseInt(req.query.page)

      if (isNaN(currentPage) || !isFinite(currentPage) || currentPage < 0) {
        return res.status(400).send()
      }

      const items = await query.limit(pageCount).offset(pageCount * currentPage)
      const pubItems = items.map(x => asActivity ? x.activityPubActivity() : x.activityPub())

      res.json(factory._collectionPage(type + 'Page', req.originalUrl, currentPage, pubItems, req))
    } else {
      res.json(factory._collectionPointer(type, req.originalUrl, total, pageCount))
    }
  }

  function orderedCollection (query, asActivity, countQuery) {
    return _collection.bind(this, 'OrderedCollection', query, asActivity, countQuery)
  }

  function collection (query, asActivity, countQuery) {
    return _collection.bind(this, 'Collection', query, asActivity, countQuery)
  }

  function postHandler (req, res, next) {
    if (!req.body) {
      return res.status(400).send()
    }

    const ctx = req.body['@context']
    if (Array.isArray(ctx)
      ? !ctx.includes('https://www.w3.org/ns/activitystreams')
      : ctx !== 'https://www.w3.org/ns/activitystreams') {
      return res.status(400).send()
    }

    const type = req.body.type
    const actor = new URL('/@' + req.user.username, process.env.BASE_URL).href

    if (vals.objectTypes.includes(type) || vals.linkTypes.includes(type)) {
      req.activity = factory.createObj(req.body, actor)
    } else if (vals.activityTypes.includes(type)) {
      if (req.body.actor !== actor) {
        return res.status(400).send()
      }
      req.activity = req.body
    } else {
      return res.status(400).send()
    }

    next()
  }

  return {
    orderedCollection,
    collection,

    postHandler
  }
})()

module.exports = {
  middleware,
  factory,
  vals
}
