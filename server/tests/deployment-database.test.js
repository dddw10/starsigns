const path = require('path');
const { spawnSync } = require('child_process');

// Explicit opt-in: never pull images or connect to an existing database.
const databaseTest = process.env.RUN_DEPLOYMENT_DB_TESTS === '1' ? test : test.skip;
const docker = args => spawnSync('docker', args, { encoding: 'utf8', timeout: 30000 });
const checked = args => {
  const result = docker(args);
  if (result.status !== 0) throw new Error(`Fixture Docker operation failed: ${args[0]} (${result.status})`);
  return result.stdout.trim();
};

databaseTest('isolated Mongo rejects anonymous access, grants only business DB readWrite, and Redis requires its password', async () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const network = `fortune-test-net-${suffix}`;
  const mongo = `fortune-test-mongo-${suffix}`;
  const redis = `fortune-test-redis-${suffix}`;
  const resources = [];
  checked(['image', 'inspect', 'mongo:7']);
  checked(['image', 'inspect', 'redis:7-alpine']);
  checked(['network', 'create', '--internal', network]);
  try {
    checked(['run', '--pull=never', '-d', '--name', mongo, '--network', network,
      '-e', 'MONGO_INITDB_ROOT_USERNAME=fixture_admin', '-e', 'MONGO_INITDB_ROOT_PASSWORD=fixture_root_pass',
      '-e', 'MONGO_INITDB_DATABASE=fixture_business', '-e', 'MONGO_APP_USERNAME=fixture_app', '-e', 'MONGO_APP_PASSWORD=fixture_app_pass',
      '--mount', `type=bind,src=${path.resolve(__dirname, '../scripts/init-mongo-user.js')},dst=/docker-entrypoint-initdb.d/10-app-user.js,readonly`,
      'mongo:7', '--auth']);
    resources.push(mongo);
    checked(['run', '--pull=never', '-d', '--name', redis, '--network', network,
      'redis:7-alpine', 'redis-server', '--requirepass', 'fixture_redis_pass']);
    resources.push(redis);

    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      const result = docker(['exec', mongo, 'mongosh', '--quiet', '--host', mongo,
        '-u', 'fixture_app', '-p', 'fixture_app_pass', '--authenticationDatabase', 'fixture_business',
        '--eval', 'db.getSiblingDB("fixture_business").probe.findOne()']);
      if (result.status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    expect(ready).toBe(true);

    const anonymous = docker(['exec', mongo, 'mongosh', '--quiet', '--host', mongo, '--eval',
      'try { db.getSiblingDB("fixture_business").probe.findOne(); quit(2); } catch (error) { quit(error.code === 13 ? 0 : 3); }']);
    expect(anonymous.status).toBe(0);
    const application = docker(['exec', mongo, 'mongosh', '--quiet', '--host', mongo,
      '-u', 'fixture_app', '-p', 'fixture_app_pass', '--authenticationDatabase', 'fixture_business', '--eval', `
      const business = db.getSiblingDB('fixture_business');
      business.probe.insertOne({_id: 'probe', value: 42});
      if (business.probe.findOne({_id: 'probe'}).value !== 42) quit(2);
      business.probe.deleteOne({_id: 'probe'});
      try { business.createUser({user: 'forbidden', pwd: 'forbidden', roles: []}); quit(3); }
      catch (error) { if (error.code !== 13) quit(4); }
      try { db.getSiblingDB('admin').system.users.findOne(); quit(5); }
      catch (error) { if (error.code !== 13) quit(6); }
    `]);
    expect(application.status).toBe(0);
    const wrongPassword = docker(['exec', mongo, 'mongosh', '--quiet', '--host', mongo,
      '-u', 'fixture_app', '-p', 'wrong', '--authenticationDatabase', 'fixture_business', '--eval', 'db.probe.findOne()']);
    expect(wrongPassword.status).not.toBe(0);

    expect(checked(['exec', redis, 'redis-cli', 'GET', 'probe'])).toContain('NOAUTH');
    expect(checked(['exec', '-e', 'REDISCLI_AUTH=fixture_redis_pass', redis, 'redis-cli', 'SET', 'probe', '42', 'EX', '30'])).toBe('OK');
    expect(checked(['exec', '-e', 'REDISCLI_AUTH=fixture_redis_pass', redis, 'redis-cli', 'GET', 'probe'])).toBe('42');
    expect(checked(['exec', '-e', 'REDISCLI_AUTH=fixture_redis_pass', redis, 'redis-cli', 'DEL', 'probe'])).toBe('1');
    for (const name of resources) {
      expect(JSON.parse(checked(['inspect', '--format', '{{json .HostConfig.PortBindings}}', name])) || {}).toEqual({});
    }
  } finally {
    // Only names created by this invocation; -v also removes their anonymous image volumes.
    for (const name of resources.reverse()) checked(['rm', '-f', '-v', name]);
    checked(['network', 'rm', network]);
  }
}, 90000);
