module.exports = function server (options) {
  const Express = require('express')
  const Knex = require('knex')
  const Objection = require('objection')
  const session = require('express-session')

  const routers = require('./routers')
  const helpers = require('./helpers')
  require('./models')

  // Initialize Express
  const app = Express()
  app.use(Express.json())
  app.use(Express.urlencoded({ extended: true }))
  app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: options.sessionSecret,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 1 month
  }))
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.set('base url', options.baseUrl)

  // Initialize Knex/Objection
  const knexConfig = require('./knexfile')
  const knex = Knex(knexConfig[options.knexConfig])
  Objection.Model.knex(knex)

  // Bind routers
  app.use('/.well-known/webfinger', routers.webfinger)
  app.use('/', (req, res, next) => {
    // This middleware (more of a "splitter") takes care of ActivityPub vs. HTML routing.
    if (helpers.routing.isActivityPub(req)) return routers.activityPub(req, res, next)
    else return routers.frontend(req, res, next)
  })

  return app
}
