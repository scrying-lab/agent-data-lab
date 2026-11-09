# Source: https://github.com/aws-samples/sample-strands-agents-hands-on-workshop/blob/243a08d788dcb1589023a95d35afbf1270acfd0a/samples/02-hooks/chat.py
# Original file: samples/02-hooks/chat.py
# License: MIT-0. Shortened excerpt (print statements removed, reset folded into a lambda).
from strands import Agent
from strands.hooks import HookProvider, HookRegistry, BeforeInvocationEvent, BeforeToolCallEvent
from customer_service_tools import lookup_customer


class RateLimiterHook(HookProvider):
    """Caps each tool at max_calls per agent invocation."""
    def __init__(self, max_calls: int = 3):
        self.max_calls = max_calls
        self.counts: dict[str, int] = {}

    def register_hooks(self, registry: HookRegistry) -> None:
        registry.add_callback(BeforeInvocationEvent, lambda event: self.counts.clear())
        registry.add_callback(BeforeToolCallEvent, self.check)

    def check(self, event: BeforeToolCallEvent) -> None:
        name = event.tool_use["name"]
        self.counts[name] = self.counts.get(name, 0) + 1
        if self.counts[name] > self.max_calls:
            event.cancel_tool = f"'{name}' hit the {self.max_calls}-call limit. Do NOT call this tool again."

agent = Agent(tools=[lookup_customer], hooks=[RateLimiterHook(max_calls=1)])
