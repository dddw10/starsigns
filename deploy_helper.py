import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
import paramiko

ROOT = Path(__file__).resolve().parent


def remote_exec(ssh, command, source=None):
    stdin, stdout, stderr = ssh.exec_command(command)
    if source is not None:
        stdin.write(source)
        stdin.flush()
        stdin.channel.shutdown_write()
    # 同时排空两个流，避免先等退出状态时填满 SSH channel 窗口。
    with ThreadPoolExecutor(max_workers=2) as pool:
        out = pool.submit(stdout.read)
        err = pool.submit(stderr.read)
        output, errors = out.result(), err.result()
    status = stdout.channel.recv_exit_status()
    if output:
        print(output.decode('utf-8', errors='replace'))
    if errors:
        print(errors.decode('utf-8', errors='replace'), file=sys.stderr)
    if status != 0:
        raise RuntimeError(f'Remote command failed ({status})')


def main():
    env = os.environ
    host, user = env.get('DEPLOY_HOST', ''), env.get('DEPLOY_USER', '')
    if not re.fullmatch(r'[a-zA-Z0-9.:-]+', host) or not re.fullmatch(r'[a-zA-Z0-9_-]+', user):
        raise RuntimeError('Set valid DEPLOY_HOST and DEPLOY_USER')
    if any(arg != '--dry-run' for arg in sys.argv[1:]):
        raise RuntimeError('Usage: python deploy_helper.py [--dry-run]')
    port = int(env.get('DEPLOY_PORT', '22'))
    if not 1 <= port <= 65535:
        raise RuntimeError('Invalid DEPLOY_PORT')
    options = {'hostname': host, 'port': port, 'username': user, 'timeout': 15, 'auth_timeout': 15, 'banner_timeout': 15}
    if env.get('DEPLOY_KEY_PATH'):
        options['key_filename'] = env['DEPLOY_KEY_PATH']
    elif env.get('DEPLOY_PASSWORD'):
        options['password'] = env['DEPLOY_PASSWORD']
    remote_dir = env.get('APP_DIR', '/opt/fortune-server')
    env_file = env.get('DEPLOY_ENV_FILE', '.env.production')
    compose_file = env.get('DEPLOY_COMPOSE_FILE', 'docker-compose.prod.yml')
    quote = shlex.quote
    ssh = paramiko.SSHClient()
    try:
        ssh.load_system_host_keys()
        if env.get('DEPLOY_KNOWN_HOSTS'):
            ssh.load_host_keys(env['DEPLOY_KNOWN_HOSTS'])
        ssh.set_missing_host_key_policy(paramiko.RejectPolicy())
        ssh.connect(**options)
        proxy = (ROOT / 'server/src/config/proxy.js').read_text(encoding='utf-8').replace('module.exports = { trustedProxies };', '')
        preflight = (ROOT / 'server/scripts/deploy-preflight.js').read_text(encoding='utf-8')
        preflight = re.sub(r'^#![^\n]*\n', '', preflight).replace("const { trustedProxies } = require('../src/config/proxy');", proxy)
        remote_exec(ssh, f'cd {quote(remote_dir)} && node - --env-file {quote(env_file)} -f {quote(compose_file)}', preflight)
        if '--dry-run' in sys.argv:
            return
        subprocess.run(['node', 'build-and-pack.js'], cwd=ROOT, check=True)
        sftp = ssh.open_sftp()
        try:
            sftp.put(str(ROOT / 'server-deploy.tar.gz'), f'{remote_dir}/server-deploy.tar.gz')
        finally:
            sftp.close()
        script = (ROOT / 'server/scripts/deploy-remote.sh').read_text(encoding='utf-8')
        remote_exec(ssh, f'APP_DIR={quote(remote_dir)} DEPLOY_ENV_FILE={quote(env_file)} DEPLOY_COMPOSE_FILE={quote(compose_file)} sh -s', script)
        print('Deployment complete')
    finally:
        ssh.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # 验证异常只报告类型，避免凭据或远端错误内容被回显。
        print(f'Deployment failed: {type(error).__name__}', file=sys.stderr)
        sys.exit(1)
