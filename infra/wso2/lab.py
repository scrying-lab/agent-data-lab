"""Operate the local workshop gateway. Secrets stay under private-runs or in memory."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import urllib.request
from urllib.error import HTTPError
import zipfile

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / "private-runs" / "wso2"
VERSION = "1.2.0"
NAME = "wso2apip-ai-gateway-" + VERSION
DIST = PRIVATE / NAME
ARCHIVE = "https://github.com/wso2/api-platform/releases/download/ai-gateway/v1.2.0/" + NAME + ".zip"
DIGEST = "6fe3581223b2522d41a79fdebdfb1f04232f5c35dc8a2daeff54fdc80fce5308"
HERE = Path(__file__).resolve().parent
API = "http://127.0.0.1:9090/api/management/v1"

def secret_file(name, value):
    path = PRIVATE / name
    with path.open("x") as f:
        f.write(value)
    return path

def prepare(archive):
    if not archive:
        archive = PRIVATE / (NAME + ".zip")
        if not archive.exists():
            urllib.request.urlretrieve(ARCHIVE, archive)
    if hashlib.sha256(Path(archive).read_bytes()).hexdigest() != DIGEST:
        raise SystemExit("Archive digest differs from the reviewed release.")
    if not DIST.exists():
        with zipfile.ZipFile(archive) as bundle:
            bundle.extractall(PRIVATE)
    password = PRIVATE / "admin-password"
    if not password.exists():
        secret_file(password.name, secrets.token_urlsafe(30))
    if not (DIST / "api-platform.env").exists():
        subprocess.run(["bash","scripts/setup.sh","--force"],cwd=DIST,check=True,
                       env={**os.environ,"ADMIN_USERNAME":"admin","ADMIN_PASSWORD":password.read_text()},
                       stdout=subprocess.DEVNULL)
    print("Prepared pinned local distribution.")

def compose(action, profile):
    env = os.environ.copy()
    for key in ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"]:
        env.pop(key, None)
    if profile:
        raw = subprocess.check_output(["aws","configure","export-credentials","--profile",profile,"--format","process"])
        credentials = json.loads(raw)
        if not credentials.get("SessionToken"):
            raise SystemExit("Select a profile with short-lived lab-role credentials.")
        env.update(AWS_ACCESS_KEY_ID=credentials["AccessKeyId"], AWS_SECRET_ACCESS_KEY=credentials["SecretAccessKey"], AWS_SESSION_TOKEN=credentials["SessionToken"])
    args = ["docker","compose","-p","agent-data-lab-wso2","-f",str(DIST/"docker-compose.yaml"),"-f",str(HERE/"local.yaml")]
    cmd = {"check":["config","--quiet"], "start":["up","-d","gateway-controller","gateway-runtime"], "stop":["down"]}[action]
    subprocess.run(args + cmd, cwd=DIST, env=env, check=True)

def api(path, method="GET", payload=None, mime="application/json"):
    auth = base64.b64encode(("admin:" + (PRIVATE/"admin-password").read_text()).encode()).decode()
    req = urllib.request.Request(API + path,data=payload,method=method,headers={"Authorization":"Basic "+auth,"Content-Type":mime})
    try:
        with urllib.request.urlopen(req,timeout=20) as response:
            return response.read()
    except HTTPError as error:
        if error.code == 404 and method == "GET":
            return None
        raise RuntimeError(f"Management API returned {error.code} for {method} {path}. Inspect the gateway controller log.") from None

def configure():
    collection = "/llm-providers"
    resource = collection + "/lab-bedrock"
    if api(resource) is None:
        api(collection,"POST",(HERE/"provider.yaml").read_bytes(),"application/yaml")
    key = PRIVATE / "consumer-key"
    if not key.exists():
        result = json.loads(api(resource+"/api-keys","POST",b'{"name":"lab-recorder"}'))
        value = result["apiKey"]["apiKey"]
        if not value:
            raise RuntimeError("Gateway did not return a consumer key.")
        secret_file(key.name,value)
    print("Gateway provider and private consumer key are ready.")

if __name__ == "__main__":
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["prepare","check","start","configure","stop"])
    parser.add_argument("--archive",type=Path)
    parser.add_argument("--profile", help="Short-lived, Bedrock-scoped AWS profile for a live rehearsal")
    args = parser.parse_args()
    PRIVATE.mkdir(parents=True,exist_ok=True)
    if args.action == "prepare":
        prepare(args.archive)
    elif args.action == "configure":
        configure()
    else:
        compose(args.action,args.profile)
