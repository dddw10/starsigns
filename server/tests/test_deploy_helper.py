from contextlib import redirect_stdout, redirect_stderr
import io
import os
from pathlib import Path
import runpy
import subprocess
import unittest
from unittest.mock import patch
import paramiko

ROOT = Path(__file__).resolve().parents[2]


class HostFixture(paramiko.SSHClient):
    events = []
    host_kind = "known"
    failure = None

    def _log(self, *_): pass

    def load_system_host_keys(self, filename=None):
        self.events.append("system_hosts")

    def load_host_keys(self, filename):
        self.events.append("specified_hosts")

    def connect(self, **kwargs):
        key = paramiko.RSAKey.generate(1024)
        if self.host_kind == "unknown":
            self._policy.missing_host_key(self, kwargs["hostname"], key)
        elif self.host_kind == "mismatch":
            raise paramiko.BadHostKeyException(kwargs["hostname"], key, paramiko.RSAKey.generate(1024))
        self.events.append("verified")

    def open_sftp(self):
        self.events.append("sftp_verified_client")
        return SftpFixture()

    def exec_command(self, command):
        self.events.append(("exec", command))
        phase = "preflight" if "node - --env-file" in command else "release"
        stream = io.BytesIO(b"")
        status = 7 if self.failure == phase else 0
        stream.channel = type("Channel", (), {"recv_exit_status": lambda self: status, "shutdown_write": lambda self: None})()
        stdin = io.StringIO()
        stdin.channel = stream.channel
        return stdin, stream, io.BytesIO(b"")

    def close(self):
        self.events.append("closed")


class SftpFixture:
    def mkdir(self, _): pass
    def put(self, *_):
        if HostFixture.failure == "upload": raise OSError("fixture-private-secret")
        HostFixture.events.append("uploaded")
    def close(self): HostFixture.events.append("sftp_closed")


class UnverifiedTransport:
    def __init__(self, *_): pass
    def connect(self, **_): HostFixture.events.append("unverified_transport")
    def close(self): pass


class DeploymentSshTests(unittest.TestCase):
    def invoke(self, kind="known", failure=None, dry_run=False):
        HostFixture.events = []
        HostFixture.host_kind = kind
        HostFixture.failure = failure
        env = {"DEPLOY_HOST": "fixture.invalid", "DEPLOY_USER": "fixture", "DEPLOY_PASSWORD": "fixture-password", "DEPLOY_KNOWN_HOSTS": "fixture_hosts", "APP_DIR": "/opt/fortune fixture", "DEPLOY_ENV_FILE": "custom.env", "DEPLOY_COMPOSE_FILE": "compose.custom.yml"}
        self.output = io.StringIO()
        def build(*args, **kwargs):
            HostFixture.events.append("build")
            if failure == "build": raise subprocess.CalledProcessError(8, "node")
        with patch.dict(os.environ, env, clear=True), patch.object(paramiko, "SSHClient", HostFixture), patch.object(paramiko, "Transport", UnverifiedTransport), patch.object(paramiko.SFTPClient, "from_transport", return_value=SftpFixture()), patch("subprocess.run", side_effect=build), patch("sys.argv", ["deploy_helper.py"] + (["--dry-run"] if dry_run else [])), redirect_stdout(self.output), redirect_stderr(self.output):
            try:
                runpy.run_path(str(ROOT / "deploy_helper.py"), run_name="__main__")
                return 0
            except (SystemExit, RuntimeError, paramiko.SSHException) as error:
                return getattr(error, "code", 1)

    def test_unknown_and_mismatched_host_keys_refuse_upload(self):
        for kind in ["unknown", "mismatch"]:
            with self.subTest(kind=kind):
                self.assertNotEqual(self.invoke(kind), 0)
                self.assertNotIn("uploaded", HostFixture.events)

    def test_known_host_upload_and_exec_share_verified_client(self):
        self.assertEqual(self.invoke("known"), 0)
        self.assertIn("system_hosts", HostFixture.events)
        self.assertIn("specified_hosts", HostFixture.events)
        self.assertIn("sftp_verified_client", HostFixture.events)
        self.assertNotIn("unverified_transport", HostFixture.events)
        self.assertLess(HostFixture.events.index("verified"), HostFixture.events.index("uploaded"))
        commands = [event[1] for event in HostFixture.events if isinstance(event, tuple)]
        self.assertEqual(commands, ["cd '/opt/fortune fixture' && node - --env-file custom.env -f compose.custom.yml", "APP_DIR='/opt/fortune fixture' DEPLOY_ENV_FILE=custom.env DEPLOY_COMPOSE_FILE=compose.custom.yml sh -s"])
        self.assertEqual(HostFixture.events[-1], "closed")

    def test_dry_run_does_not_build_upload_or_release(self):
        self.assertEqual(self.invoke(dry_run=True), 0)
        self.assertNotIn("build", HostFixture.events)
        self.assertNotIn("uploaded", HostFixture.events)
        self.assertEqual(len([e for e in HostFixture.events if isinstance(e, tuple)]), 1)

    def test_all_failure_phases_stop_and_close_the_verified_connection(self):
        for phase in ["preflight", "build", "upload", "release"]:
            with self.subTest(phase=phase):
                self.assertNotEqual(self.invoke(failure=phase), 0)
                self.assertEqual(HostFixture.events[-1], "closed")
                self.assertNotIn("fixture-private-secret", self.output.getvalue())
                self.assertNotIn("Deployment complete", self.output.getvalue())
                if phase in ["preflight", "build", "upload"]:
                    self.assertEqual(len([e for e in HostFixture.events if isinstance(e, tuple)]), 1)
                if phase == "preflight": self.assertNotIn("build", HostFixture.events)
                if phase == "upload": self.assertIn("sftp_closed", HostFixture.events)


if __name__ == "__main__": unittest.main()
