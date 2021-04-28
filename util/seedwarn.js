require('dotenv').config()
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

if (process.env.NODE_ENV === 'production') {
  console.log('EXTRASUPERWARNING: YOU ARE IN PRODUCTION. YOU WILL DELETE THINGS FROM YOUR PRODUCTION DATABASE. THIS IS NOT RECOMMENDED!!!!!!!!')
}
rl.question('WARNING: Seeding a database deletes all prior entries in it. Seeding introduces users with known passwords, which might be exploited by attackers. Seeding should only be used in development, for debugging purposes. Are you sure you want to do this? (YES/no) ', x => {
  if (x === 'YES') {
    console.log('Cool, seeding now...')
    process.exit(0)
  } else {
    console.log('OK, not seeding.')
    process.exit(1)
  }
})
