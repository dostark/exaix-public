import re

path = 'tests/flows/flow_loader_test.ts'

with open(path, 'r') as f:
    content = f.read()

# Replace any:
#   import { defineFlow } from "../../src/flows/define_flow.ts";
#
# export default defineFlow({
# ... JSON ...
# });
# with standard yaml map:
# id: ...
# name: ...

def repl(match):
    body = match.group(1)
    body = re.sub(r'([a-zA-Z0-9_]+):', r'\1:', body)
    # Remove array brackets if single line
    body = re.sub(r'steps:\s*\[{([^}]*)}\]', r'steps:\n  - \1', body)

    # Simple replace - actually, just remove export and defineFlow, keep as yaml-like
    # since yaml parses JSON objects natively. We just strip the JS.
    yaml_like = body

    return yaml_like

content = re.sub(r'import\s+\{\s*defineFlow.*?;.*?\n\s*export\s+default\s+defineFlow\(\{(.*?)\}\);', repl, content, flags=re.DOTALL)

with open(path, 'w') as f:
    f.write(content)
