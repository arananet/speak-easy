#!/usr/bin/env python3
"""Build and deploy the Speak Easy worker via the Cloudflare API.

Uses the vault-stored token (custom.cloudflare). The token needs
Workers Scripts Edit for deploys and secret management.

Usage:
    deploy-worker.py deploy                  # build + upload worker (needs Workers Scripts Edit)
    deploy-worker.py set-user-secret <user>  # set BLANQUITA_PASSWORD or EDUARDO_PASSWORD from a hidden prompt (never logged)
    deploy-worker.py set-secret              # set the legacy APP_PASSWORD from a hidden prompt (never logged)
    deploy-worker.py url                     # print the workers.dev URL

The worker gets the Workers AI binding, so inference needs no token at runtime.
"""
import getpass
import hashlib
import json
import subprocess
import sys
import urllib.request

sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

ACCOUNT_ID = "693ae9c587f1f2c34328bb47447366b0"
API = "https://api.cloudflare.com/client/v4"
SCRIPT_NAME = "speak-easy"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise RuntimeError("redirect refused, verify the endpoint")


def authed(path, method="GET", data=None, content_type="application/json"):
    req = urllib.request.Request(API + path, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", content_type)
    add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=["api.cloudflare.com"])
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=120) as resp:
            return read_json_response(resp)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} on {method} {path}: {e.read().decode(errors='replace')[:1500]}")


def build():
    r = subprocess.run(["node", "scripts/build.js"], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"build failed: {r.stderr or r.stdout}")
    print(r.stdout.strip(), file=sys.stderr)
    with open("dist/worker.js", "rb") as f:
        return f.read()


def deploy():
    script = build()
    metadata = {
        "main_module": "worker.js",
        "compatibility_date": "2025-06-01",
        "bindings": [{"type": "ai", "name": "AI"}],
    }
    boundary = "----speakdeploy" + hashlib.md5(b"speak-easy").hexdigest()
    parts = []
    parts.append(
        "--%s\r\nContent-Disposition: form-data; name=\"metadata\"\r\n"
        "Content-Type: application/json\r\n\r\n%s\r\n" % (boundary, json.dumps(metadata))
    )
    body = "".join(parts).encode() + (
        "--%s\r\nContent-Disposition: form-data; name=\"worker.js\"; filename=\"worker.js\"\r\n"
        "Content-Type: application/javascript+module\r\n\r\n" % boundary
    ).encode() + script + ("\r\n--%s--\r\n" % boundary).encode()

    resp = authed(
        f"/accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT_NAME}",
        method="PUT", data=body,
        content_type=f"multipart/form-data; boundary={boundary}",
    )
    if not resp.get("success"):
        raise RuntimeError(f"deploy failed: {resp}")
    # Raw API uploads leave the workers.dev route disabled (error 1042);
    # wrangler enables it by default, so do it explicitly here.
    sub_resp = authed(
        f"/accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT_NAME}/subdomain",
        method="POST", data=json.dumps({"enabled": True}).encode(),
    )
    if not sub_resp.get("success"):
        raise RuntimeError(f"subdomain enable failed: {sub_resp}")
    sub = authed(f"/accounts/{ACCOUNT_ID}/workers/subdomain").get("result", {}).get("subdomain")
    print(f"https://{SCRIPT_NAME}.{sub}.workers.dev")


USER_SECRETS = {"blanquita": "BLANQUITA_PASSWORD", "eduardo": "EDUARDO_PASSWORD"}


def set_user_secret(username):
    binding = USER_SECRETS[username]
    pw = getpass.getpass(f"{binding} for {username} (hidden, never logged): ").strip()
    if len(pw) < 8:
        raise RuntimeError("password must be at least 8 characters")
    resp = authed(
        f"/accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT_NAME}/secrets",
        method="PUT",
        data=json.dumps({"name": binding, "text": pw, "type": "secret_text"}).encode(),
    )
    if not resp.get("success"):
        raise RuntimeError(f"set-user-secret failed: {resp}")
    print(f"{binding} set")


def set_secret():
    pw = getpass.getpass("APP_PASSWORD for Blanca (hidden, never logged): ").strip()
    if len(pw) < 8:
        raise RuntimeError("password must be at least 8 characters")
    resp = authed(
        f"/accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT_NAME}/secrets",
        method="PUT",
        data=json.dumps({"name": "APP_PASSWORD", "text": pw, "type": "secret_text"}).encode(),
    )
    if not resp.get("success"):
        raise RuntimeError(f"set-secret failed: {resp}")
    print("APP_PASSWORD set")


def main():
    args = sys.argv[1:]
    valid = (
        len(args) == 1 and args[0] in ("deploy", "set-secret", "url")
    ) or (
        len(args) == 2 and args[0] == "set-user-secret" and args[1] in USER_SECRETS
    )
    if not valid:
        print(__doc__, file=sys.stderr)
        return 2
    try:
        if args[0] == "deploy":
            deploy()
        elif args[0] == "set-secret":
            set_secret()
        elif args[0] == "set-user-secret":
            set_user_secret(args[1])
        else:
            sub = authed(f"/accounts/{ACCOUNT_ID}/workers/subdomain").get("result", {}).get("subdomain")
            print(f"https://{SCRIPT_NAME}.{sub}.workers.dev")
        return 0
    except RuntimeError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
