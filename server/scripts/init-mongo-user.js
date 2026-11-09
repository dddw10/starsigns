// 只由官方镜像在空卷初始化时运行，已有卷须按运维手册先建账户。
const database = process.env.MONGO_INITDB_DATABASE;
const username = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;
if (!database || !username || !password
  || username === process.env.MONGO_INITDB_ROOT_USERNAME
  || password === process.env.MONGO_INITDB_ROOT_PASSWORD) {
  throw new Error('Distinct Mongo application credentials are required');
}
db.getSiblingDB(database).createUser({
  user: username,
  pwd: password,
  roles: [{ role: 'readWrite', db: database }],
});
