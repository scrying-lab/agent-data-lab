# Source: https://github.com/aws-samples/sample-strands-agents-hands-on-workshop/blob/243a08d788dcb1589023a95d35afbf1270acfd0a/samples/01-agent-loop-tools/chat.py
# Original file: samples/01-agent-loop-tools/chat.py (the model-switch comments, written out as code)
# License: MIT-0. Shortened excerpt.
from strands import Agent
from strands.models import BedrockModel, OllamaModel
from customer_service_tools import lookup_customer

# Amazon Bedrock, here with a Nova model ID from the workshop's list.
model = BedrockModel(model_id="amazon.nova-pro-v1:0")

# Or run locally without AWS credentials using Ollama (needs: pip install strands-agents[ollama]).
model = OllamaModel(host="http://localhost:11434", model_id="llama3.1")

agent = Agent(model=model, tools=[lookup_customer])
