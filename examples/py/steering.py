# Source: https://github.com/aws-samples/sample-strands-agents-hands-on-workshop/blob/243a08d788dcb1589023a95d35afbf1270acfd0a/samples/03-skills-steering/steering_handlers.py
# Original file: samples/03-skills-steering/steering_handlers.py (Agent setup from chat.py)
# License: MIT-0. Shortened excerpt (first workflow rule only, prints removed).
from strands import Agent
from strands.vended_plugins.steering import SteeringHandler, Proceed, Guide, ToolSteeringAction, LedgerProvider
from customer_service_tools import lookup_customer, process_refund


class RefundWorkflowHandler(SteeringHandler):
    name = "refund-workflow"

    def __init__(self):
        super().__init__(context_providers=[LedgerProvider()])

    async def steer_before_tool(self, *, agent, tool_use, **kwargs) -> ToolSteeringAction:
        if tool_use.get("name") != "process_refund":
            return Proceed(reason="Not a refund operation")
        tool_calls = self.steering_context.data.get("ledger", {}).get("tool_calls", [])
        if not any(c["tool_name"] == "lookup_customer" and c["status"] == "success" for c in tool_calls):
            return Guide(reason="You must look up the customer with lookup_customer before processing a refund.")
        return Proceed(reason="Refund workflow validated")


agent = Agent(tools=[lookup_customer, process_refund], plugins=[RefundWorkflowHandler()])
