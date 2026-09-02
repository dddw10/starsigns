import os
import subprocess
import paramiko

# 1. 运行本地打包
print("==========================================")
print("1. 正在运行本地打包 build-and-pack.js...")
print("==========================================")

try:
    result = subprocess.run(["node", "build-and-pack.js"], check=True, capture_output=True, text=True)
    print(result.stdout)
except subprocess.CalledProcessError as e:
    print("本地编译打包失败:")
    print(e.stderr)
    exit(1)

# 2. 准备上传和SSH连接参数
host = os.environ.get("DEPLOY_HOST")
port = int(os.environ.get("DEPLOY_PORT", "22"))
username = os.environ.get("DEPLOY_USER")
password = os.environ.get("DEPLOY_PASSWORD")
key_filename = os.environ.get("DEPLOY_KEY_PATH")
local_zip = "server-deploy.zip"
remote_dir = "/opt/fortune-server"
remote_zip = f"{remote_dir}/server-deploy.zip"

if not host or not username:
    raise RuntimeError("Set DEPLOY_HOST and DEPLOY_USER before deploying.")

connect_options = {"hostname": host, "port": port, "username": username}
if key_filename:
    connect_options["key_filename"] = key_filename
elif password:
    connect_options["password"] = password
else:
    raise RuntimeError("Set DEPLOY_KEY_PATH or DEPLOY_PASSWORD before deploying.")


print("==========================================")
print("2. 正在通过 SFTP 上传部署包到云服务器...")
print("==========================================")

try:
    # 建立 SSH 传输通道
    transport = paramiko.Transport((host, port))
    if key_filename:
        private_key = paramiko.RSAKey.from_private_key_file(key_filename)
        transport.connect(username=username, pkey=private_key)
    else:
        transport.connect(username=username, password=password)
    
    # 建立 SFTP
    sftp = paramiko.SFTPClient.from_transport(transport)
    
    # 确保远端目录存在
    try:
        sftp.mkdir(remote_dir)
        print(f"创建远端目录: {remote_dir}")
    except IOError:
        pass  # 目录已存在
        
    print(f"正在上传 {local_zip} -> {remote_zip}...")
    sftp.put(local_zip, remote_zip)
    print("上传部署包成功！")
    sftp.close()
    transport.close()
except Exception as e:
    print(f"SFTP 上传失败: {e}")
    exit(1)

print("==========================================")
print("3. 正在登录服务器解压并启动 Docker 容器...")
print("==========================================")

try:
    # 建立 SSH 连接
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(**connect_options)
    
    ssh_cmd = (
        f"cd {remote_dir} && "
        "if [ -d src ]; then rm -rf src_bak; mv src src_bak; fi && "
        "unzip -o server-deploy.zip && "
        "docker compose -f docker-compose.prod.yml build --no-cache && "
        "docker compose -f docker-compose.prod.yml up -d && "
        "docker compose -f docker-compose.prod.yml ps"
    )
    
    print(f"运行远端指令: {ssh_cmd}")
    stdin, stdout, stderr = ssh.exec_command(ssh_cmd)
    
    # 等待命令执行完毕并获取输出
    exit_status = stdout.channel.recv_exit_status()
    
    print("\n[远端标准输出]:")
    print(stdout.read().decode('utf-8'))
    
    print("[远端标准错误]:")
    print(stderr.read().decode('utf-8'))
    
    if exit_status == 0:
        print("==========================================")
        print("云端部署更新顺利完成！")
        print("==========================================")
    else:
        print(f"远端执行失败，退出状态码: {exit_status}")
        
    ssh.close()
except Exception as e:
    print(f"SSH 远端部署失败: {e}")
    exit(1)
