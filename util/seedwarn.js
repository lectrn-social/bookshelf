require('dotenv').config()

if (process.env.NODE_ENV === 'production') {
  console.log('You are in production, refusing to seed. (see NODE_ENV environment variable)')
  process.exit(1)
} else {
  process.exit(0)
}
