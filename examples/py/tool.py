# Source: https://github.com/aws-samples/sample-strands-agents-hands-on-workshop/blob/243a08d788dcb1589023a95d35afbf1270acfd0a/samples/01-agent-loop-tools/customer_service_tools.py
# Original file: samples/01-agent-loop-tools/customer_service_tools.py
# License: MIT-0. Shortened excerpt (mock data trimmed to name and status).
from strands import Agent, tool

CUSTOMERS = {
    "C-1001": {"name": "Sarah Johnson", "account_status": "active"},
    "C-1002": {"name": "Mike Chen", "account_status": "active"},
}


@tool
def lookup_customer(customer_id: str) -> str:
    """Look up a customer by their ID.

    Args:
        customer_id: The customer ID (e.g. C-1001)
    """
    customer = CUSTOMERS.get(customer_id)
    if not customer:
        return f"No customer found with ID {customer_id}"
    return f"Customer: {customer['name']}\nAccount Status: {customer['account_status']}"


agent = Agent(tools=[lookup_customer], system_prompt="You are a customer service agent.")
