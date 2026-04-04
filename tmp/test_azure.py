import os
import asyncio
from openai import AsyncAzureOpenAI
import logging

# Set up logging to see exactly what's happening
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def _load_env_safe(path: str) -> None:
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n\r")
            if not line or line.lstrip().startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip()
            if val.startswith("{") and not val.endswith("}"):
                continue
            if "  #" in val:
                val = val[:val.index("  #")].strip()
            elif "\t#" in val:
                val = val[:val.index("\t#")].strip()
            if len(val) >= 2 and val[0] in ('"', "'") and val[-1] == val[0]:
                val = val[1:-1]
            os.environ[key] = val

async def test_conn():
    env_path = "c:\\Projects\\NearDrop\\.env"
    _load_env_safe(env_path)
    
    api_key = os.getenv("AZURE_OPENAI_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT")
    
    print(f"Key: {api_key[:5]}...{api_key[-5:] if api_key else ''}")
    print(f"Endpoint: {endpoint}")
    print(f"Deployment: {deployment}")
    
    clean_endpoint = endpoint.rstrip("/") if endpoint else endpoint
    
    client = AsyncAzureOpenAI(
        api_key=api_key,
        api_version="2024-05-01-preview",
        azure_endpoint=clean_endpoint
    )
    
    try:
        print(f"Attempting completion with deployment '{deployment}'...")
        response = await client.chat.completions.create(
            model=deployment,
            messages=[{"role": "system", "content": "You are a helpful assistant."},
                      {"role": "user", "content": "Hi"}],
            max_tokens=5,
            temperature=0.3
        )
        print("Success!")
        print(f"Response: {response.choices[0].message.content}")
    except Exception as e:
        print(f"Failed: {e}")
        if hasattr(e, 'response'):
            print(f"Response status: {e.response.status_code}")
            print(f"Response text: {e.response.text}")

if __name__ == "__main__":
    asyncio.run(test_conn())
