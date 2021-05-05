const helpers = { routing: require('../routing') }

/**
 * Resolve URL/Object references to other resources.
 * This is a shallow operation.
 * NOTE: This function does not perform any permission checks.
 * @param {object} obj Object to resolve children of
 * @param {string[]} [keys] Keys to resolve. Defaults to all (string) keys.
 * @returns {object} Object with unresolved & resolved children.
 */
async function followReferences (baseUrl, obj, keys) {
  const promises = Object.entries(obj)
    .map(async ([k, v]) => {
      if (typeof k !== 'string') return [k, v]
      if (keys && !keys.includes(k)) return [k, v]
      // TODO: Filter keys the other way around: Only resolve properties that are valid as links.
      if (!keys && ['_resolver', '@context'].includes(k)) return [k, v]

      let url

      if (typeof v === 'string') {
        try {
          url = new URL(v)
        } catch (e) {
          return [k, v]
        }
      } else if (typeof v === 'object' && typeof v.id === 'string') {
        url = new URL(v.id)
      } else {
        return [k, v]
      }

      if (!helpers.routing.isResourceInternal(baseUrl, url.href)) {
        throw { err: { status: 406, msg: 'Federation Not Implemented' } } // eslint-disable-line no-throw-literal
      }

      const model = await helpers.routing.getResourceForPath(url.pathname)

      if (!model) {
        throw { err: { status: 400, msg: 'Could not resolve URL "' + url.href + '"' } } // eslint-disable-line no-throw-literal
      }

      const ref = model.activityPub(baseUrl)

      ref._resolver = {
        remote: false,
        model: model
      }

      return [k, ref]
    })

  const res = []

  try {
    for (const p of promises) {
      res.push(await p)
    }
  } catch (e) {
    if (e.err) {
      return e
    } else {
      throw e
    }
  }

  return {
    obj: Object.fromEntries(res)
  }
}

module.exports = {
  middleware: require('./middleware'),
  factory: require('./factory'),
  vals: require('./vals'),
  verify: require('./verify'),

  followReferences
}
