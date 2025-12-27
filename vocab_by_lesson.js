import pandas as pd
import json

# 1. 讀取 CSV
try:
df = pd.read_csv('B1-B6L1生詞表.csv')
except FileNotFoundError:
print("找不到檔案：B1-B6L1生詞表.csv")
exit()

# 2. 清理資料(移除空白列、前後空格)
df_clean = df.dropna(subset = ['生詞']).copy()
df_clean['生詞'] = df_clean['生詞'].astype(str).str.strip()
df_clean['課數'] = df_clean['課數'].astype(str).str.strip()

# 3. 建立分課字典
lesson_vocab = {}
for index, row in df_clean.iterrows():
    lesson = row['課數']
word = row['生詞']

if lesson not in lesson_vocab:
lesson_vocab[lesson] = []
    
    # 避免該課重複加入同一個詞
if word not in lesson_vocab[lesson]:
lesson_vocab[lesson].append(word)

# 4. 存檔
with open('vocab_by_lesson.json', 'w', encoding = 'utf-8') as f:
json.dump(lesson_vocab, f, ensure_ascii = False, indent = 2)

print(f"成功生成 vocab_by_lesson.json！共處理了 {len(lesson_vocab)} 課的生詞。")