import fitz
import os

papers = [
    'LLM based.pdf',
    'multi agent framework for long story.pdf',
    'plan_write_revise.pdf',
    'storyteller.pdf'
]

base = r'c:\Users\gandh\OneDrive\Desktop\vbox backend'

out = []
for paper in papers:
    path = os.path.join(base, paper)
    doc = fitz.open(path)
    out.append(f'\n\n===== {paper} ({len(doc)} pages) =====')
    pages_to_read = list(range(min(7, len(doc))))
    for i in pages_to_read:
        page = doc[i]
        text = page.get_text()
        if text.strip():
            out.append(f'--- Page {i+1} ---')
            out.append(text[:2500])
    doc.close()

result = '\n'.join(out)
with open(os.path.join(base, 'extracted.txt'), 'w', encoding='utf-8') as f:
    f.write(result)
print("Done! Wrote extracted.txt")
print(f"Total chars: {len(result)}")
