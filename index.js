require('dotenv').config()

const app = require('./server')({
  sessionSecret: process.env.SESSION_SECRET,
  knexConfig: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  baseUrl: process.env.BASE_URL
})

// Start Express
const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log('Listening on port ' + port + '. Hello world!')
})
