import bcrypt from "bcrypt";

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run generate-password-hash -- "temporary-password"');
  process.exit(1);
}

console.log(await bcrypt.hash(password, 12));
