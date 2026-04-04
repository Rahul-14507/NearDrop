import os
import asyncio
from openai import AsyncAzureOpenAI
import logging

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

async def list_models():
    env_path = "c:\\Projects\\NearDrop\\.env"
    _load_env_safe(env_path)
    
    api_key = os.getenv("AZURE_OPENAI_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT").rstrip("/")
    
    client = AsyncAzureOpenAI(
        api_key=api_key,
        api_version="2024-02-01",
        azure_endpoint=endpoint
    )
    
    try:
        print("Fetching models/deployments...")
        # Azure OpenAI management API for listing deployments
        # Note: listing models in Azure usually returns the model definitions, 
        # but sometimes the SDK can list deployments if configured.
        # Actually, models.list() in Azure OpenAI return the available base models.
        # We need to know the deployments.
        
        # In modern OpenAI SDK, models.list() on an Azure client 
        # might just return the models.
        models = await client.models.list()
        for m in models.data:
            print(f"Model/Deployment: {m.id}")
            
    except Exception as e:
        print(f"Failed to list: {e}")

if __name__ == "__main__":
    asyncio.run(list_models())
