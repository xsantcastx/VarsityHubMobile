from pathlib import Path
path = Path('server/src/routes/posts.ts')
text = path.read_text()
print('count', text.count('await prisma.(['))
print('snippet', text[text.index('await prisma.('):text.index('await prisma.(')+30])
