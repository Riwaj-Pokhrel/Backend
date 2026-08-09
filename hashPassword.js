const bcrypt = require('bcrypt');

const password = process.argv[2] || 'superadmin123'; // Default password if none is provided
const saltRounds = 10;

bcrypt.hash(password, saltRounds)
	.then(hash => {
		console.log(hash);
	})
	.catch(err => {
		console.error('Hashing failed:', err);
		process.exit(1);
	});