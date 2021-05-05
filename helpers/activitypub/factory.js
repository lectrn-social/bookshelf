function calculateCollectionURLProps (baseUrl, path, pageCount, total) {
  const url = new URL(path, baseUrl)

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

function calculateCollectionPageURLProps (baseUrl, path, currentPage, req) {
  const url = new URL(path, baseUrl)

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

function _collectionPointer (type, baseUrl, path, total, pageCount = 10) {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type,
    totalItems: total,
    ...calculateCollectionURLProps(baseUrl, path, pageCount, total) // id, first, last
  }
}

function _collectionPage (type, baseUrl, path, currentPage, items, req) {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: type,
    ...calculateCollectionPageURLProps(baseUrl, path, currentPage, req), // id, next, prev, partOf
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

module.exports = {
  _collectionPointer,
  orderedCollectionPointer: _collectionPointer.bind(this, 'OrderedCollection'),
  collectionPointer: _collectionPointer.bind(this, 'Collection'),

  _collectionPage,
  orderedCollectionPage: _collectionPage.bind(this, 'OrderedCollectionPage'),
  collectionPage: _collectionPage.bind(this, 'CollectionPage'),

  createObj
}
