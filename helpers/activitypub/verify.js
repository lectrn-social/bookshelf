const models = require('../../models')

async function create (baseUrl, actor, act) {
  if ((act.actor.id || act.actor) !== actor.activityPub(baseUrl).id) {
    return { err: { status: 403, msg: 'actor must be yourself' } }
  }

  if (act.object._resolver) {
    return { err: { status: 406, msg: 'Creating from resolved objects is not allowed' } }
  }

  if (act.object.type === 'Note') {
    if (typeof act.object.content !== 'string') {
      return { err: { status: 400, msg: 'object.content must be a string' } }
    }

    if (act.object.content.length < 1 || act.object.content.length > 500) {
      return { err: { status: 406, msg: 'object.content must be at least 1 and at most 500 characters' } }
    }

    if (act.object.attributedTo &&
      (act.object.attributedTo.id || act.object.attributedTo) !== actor.activityPub(baseUrl).id) {
      return { err: { status: 403, msg: 'object.attributedTo must be yourself' } }
    }
  } else {
    return { err: { status: 406, msg: 'Only the following object types are supported: Note' } }
  }
}

async function follow (baseUrl, actor, act, undo) {
  if (!act.object._resolver) {
    return { err: { status: 400, msg: 'You can only follow an existing object' } }
  }

  if (act.object.type !== 'Person') {
    return { err: { status: 406, msg: 'You can only follow users' } }
  }

  if (act.object.id === actor.activityPub(baseUrl).id) {
    return { err: { status: 400, msg: 'You can not follow yourself' } }
  }

  const existenceQuery = await models.Relationship.query()
    .limit(1)
    .where('type', 'Follow')
    .where('actor_user_id', actor.id)
    .where(...(!act.object._resolver.remote ? ['object_user_id', act.object._resolver.model.id] : ['object_url', act.object.id]))

  if (undo) {
    if (existenceQuery.length === 0) {
      return { err: { status: 409, msg: 'You aren\'t following object' } }
    } else {
      return { model: existenceQuery[0] }
    }
  } else {
    if (existenceQuery.length > 0) {
      return { err: { status: 409, msg: 'You already follow object' } }
    }
  }
}

async function like (baseUrl, actor, act, undo) {
  if (!act.object._resolver) {
    return { err: { status: 400, msg: 'You can only like an existing object' } }
  }

  if (act.object.type !== 'Note') {
    return { err: { status: 406, msg: 'You can only like Blips' } }
  }

  const existenceQuery = await models.Relationship.query()
    .limit(1)
    .where('type', 'Like')
    .where('actor_user_id', actor.id)
    .where(...(!act.object._resolver.remote ? ['object_blip_id', act.object._resolver.model.id] : ['object_url', act.object.id]))

  if (undo) {
    if (existenceQuery.length === 0) {
      return { err: { status: 409, msg: 'You don\'t like that Blip' } }
    } else {
      return { model: existenceQuery[0] }
    }
  } else {
    if (existenceQuery.length > 0) {
      return { err: { status: 409, msg: 'You already like that Blip' } }
    }
  }
}

async function announce (baseUrl, actor, act, undo) {
  if (!act.object._resolver) {
    return { err: { status: 400, msg: 'You can only like an existing object' } }
  }

  if (act.object.type !== 'Note') {
    return { err: { status: 406, msg: 'You can only like Blips' } }
  }

  const existenceQuery = await models.Relationship.query()
    .limit(1)
    .where('type', 'Reblip')
    .where('actor_user_id', actor.id)
    .where(...(!act.object._resolver.remote ? ['object_blip_id', act.object._resolver.model.id] : ['object_url', act.object.id]))

  if (undo) {
    if (existenceQuery.length === 0) {
      return { err: { status: 409, msg: 'You haven\'t reblipped that Blip' } }
    } else {
      return { model: existenceQuery[0] }
    }
  } else {
    if (existenceQuery.length > 0) {
      return { err: { status: 409, msg: 'You\'ve already reblipped that Blip' } }
    }
  }
}

const typeMap = {
  Create: create,
  Follow: follow,
  Like: like,
  Announce: announce
}

async function verify (baseUrl, actor, obj, undo = false) {
  const fn = typeMap[obj.type]
  if (!fn) throw new Error('No verifier for type ' + obj.type)
  return (await fn(baseUrl, actor, obj, undo)) || {}
}

module.exports = verify
