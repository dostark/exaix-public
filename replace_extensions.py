import os
import glob

dirs = ['src', 'tests', 'docs', 'Blueprints']

for d in dirs:
    for root, _, files in os.walk(d):
        for file in files:
            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                if '.flow.ts' in content or '.template.ts' in content:
                    content = content.replace('.flow.ts', '.flow.yaml')
                    content = content.replace('.template.ts', '.template.yaml')
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Replaced in {file_path}")
            except Exception as e:
                pass
