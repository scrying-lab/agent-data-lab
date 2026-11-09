# Source: https://github.com/aws-samples/sample-strands-agents-hands-on-workshop/blob/243a08d788dcb1589023a95d35afbf1270acfd0a/samples/01-agent-loop-tools/chat.py
# Original file: samples/01-agent-loop-tools/chat.py
# License: MIT-0. Shortened excerpt (input loop removed).
from strands import Agent
from customer_service_tools import lookup_customer, get_order_history, process_refund

agent = Agent(
    tools=[lookup_customer, get_order_history, process_refund],
    system_prompt="You are a customer service agent for an online electronics store.",
)

# The agent prints its own streamed response via the default callback handler.
# The call blocks until the turn is finished, then returns the result.
result = agent("Hi, I'm customer C-1001. What are my recent orders?")
