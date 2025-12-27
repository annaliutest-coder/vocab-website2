// app.js - 網站版生詞分析助手（含分冊累積選擇、手動切分 & 合併功能）

let tbclData = {};
let lessonData = {}; // 儲存 {"B1L1": [...], "B1L2": [...]}
let customOldVocab = new Set(); // 手動輸入的補充舊詞
let selectedLessons = new Set(); // 使用者勾選的課數
let finalBlocklist = new Set(); // 最終用來過濾的清單 (課本 + 手動)

// 【新增】已知詞彙庫 (用於斷詞引擎，確保這些詞不被切開)
// 包含使用者指定的預設詞
let knownWords = new Set(["紅色", "護龍", "還都", "看書", "吃飯", "一定"]); 

// 用於手動切分
let editingIndex = -1;

// 定義冊別順序
const BOOK_ORDER = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'];

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupEventListeners();
  loadCustomVocab();
  updateBlocklist();
});

// 1. 載入資料
async function loadData() {
  try {
    const tbclRes = await fetch('tbcl_data.json');
    tbclData = await tbclRes.json();

    const lessonRes = await fetch('vocab_by_lesson.json');
    lessonData = await lessonRes.json();
    
    // 預設全選
    Object.keys(lessonData).forEach(k => selectedLessons.add(k));
    
    // 【新增】將所有課本生詞加入「已知詞彙庫」，增強斷詞能力
    // 這樣像「護龍」這種課本詞彙就會優先被斷出來，不會被切碎
    Object.values(lessonData).forEach(wordList => {
        wordList.forEach(w => knownWords.add(w));
    });

    renderLessonCheckboxes();
    console.log('資料載入完成，已知詞彙庫已建立');
  } catch (error) {
    console.error('載入資料失敗:', error);
    alert('載入資料失敗，請確認 JSON 檔案是否存在');
  }
}

// 2. 產生課數勾選單 (改良版：標題含全選功能)
function renderLessonCheckboxes() {
  const container = document.getElementById('lessonCheckboxes');
  container.innerHTML = '';

  const books = {};
  BOOK_ORDER.forEach(b => books[b] = []);

  Object.keys(lessonData).forEach(lessonKey => {
    const match = lessonKey.match(/^(B\d+)/);
    if (match && books[match[1]]) {
        books[match[1]].push(lessonKey);
    }
  });

  BOOK_ORDER.forEach(bookName => {
      const lessons = books[bookName];
      if (lessons.length === 0) return;
      lessons.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const groupDiv = document.createElement('div');
      groupDiv.className = 'book-group';
      groupDiv.dataset.book = bookName;

      // Header
      const header = document.createElement('div');
      header.className = 'book-header';
      
      const masterCb = document.createElement('input');
      masterCb.type = 'checkbox';
      masterCb.className = 'book-master-cb';
      masterCb.dataset.book = bookName;
      masterCb.onclick = (e) => {
          e.stopPropagation();
          const checked = e.target.checked;
          const lessonCbs = content.querySelectorAll('.lesson-cb');
          lessonCbs.forEach(cb => {
              cb.checked = checked;
              if (checked) selectedLessons.add(cb.value);
              else selectedLessons.delete(cb.value);
          });
          updateBlocklist();
      };

      const titleSpan = document.createElement('span');
      titleSpan.textContent = ` ${bookName} (${lessons.length} 課)`;
      titleSpan.style.flex = '1';
      titleSpan.style.marginLeft = '8px';

      const arrowSpan = document.createElement('span');
      arrowSpan.textContent = '▼';
      arrowSpan.style.fontSize = '12px';
      arrowSpan.className = 'arrow-icon';

      header.appendChild(masterCb);
      header.appendChild(titleSpan);
      header.appendChild(arrowSpan);
      
      // Content
      const content = document.createElement('div');
      content.className = 'book-content';
      content.id = `content-${bookName}`;
      if (bookName === 'B1') {
          content.classList.add('open');
          arrowSpan.textContent = '▲';
      }

      header.onclick = () => {
          content.classList.toggle('open');
          const isOpen = content.classList.contains('open');
          arrowSpan.textContent = isOpen ? '▲' : '▼';
      };

      lessons.forEach(lesson => {
          const wrapper = document.createElement('label');
          wrapper.className = 'checkbox-item';
          
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = lesson;
          checkbox.className = `lesson-cb book-${bookName}`;
          checkbox.checked = selectedLessons.has(lesson);

          checkbox.addEventListener('change', () => {
              if (checkbox.checked) selectedLessons.add(lesson);
              else selectedLessons.delete(lesson);
              updateBlocklist();
          });

          wrapper.appendChild(checkbox);
          wrapper.appendChild(document.createTextNode(lesson));
          content.appendChild(wrapper);
      });

      groupDiv.appendChild(header);
      groupDiv.appendChild(content);
      container.appendChild(groupDiv);
  });
  
  updateBookMasterStatus();
  updateSelectedCountUI();
}

function updateBookMasterStatus() {
    BOOK_ORDER.forEach(bookName => {
        const checkboxes = document.querySelectorAll(`.lesson-cb.book-${bookName}`);
        if (checkboxes.length === 0) return;

        let checkedCount = 0;
        checkboxes.forEach(cb => {
            if (cb.checked) checkedCount++;
        });

        const masterCb = document.querySelector(`.book-master-cb[data-book="${bookName}"]`);
        if (masterCb) {
            masterCb.checked = checkedCount === checkboxes.length;
            masterCb.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
        }
    });
}

// 累積選擇
window.selectUpTo = function(targetBook) {
    const targetIndex = BOOK_ORDER.indexOf(targetBook);
    if (targetIndex === -1) return;

    const checkboxes = document.querySelectorAll('.lesson-cb');
    checkboxes.forEach(cb => {
        const lesson = cb.value;
        const match = lesson.match(/^(B\d+)/);
        if (match) {
            const book = match[1];
            const bookIndex = BOOK_ORDER.indexOf(book);
            
            if (bookIndex <= targetIndex) {
                cb.checked = true;
                selectedLessons.add(lesson);
            } else {
                cb.checked = false;
                selectedLessons.delete(lesson);
            }
        }
    });

    document.querySelectorAll('.book-content').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.arrow-icon').forEach(el => el.textContent = '▼');
    
    const targetContent = document.getElementById(`content-${targetBook}`);
    if (targetContent) {
        targetContent.classList.add('open');
        const group = targetContent.parentElement;
        const arrow = group.querySelector('.arrow-icon');
        if (arrow) arrow.textContent = '▲';
    }

    updateBlocklist();
}

// 單冊開關
window.toggleBook = function(targetBook) {
    const checkboxes = document.querySelectorAll(`.lesson-cb.book-${targetBook}`);
    let allChecked = true;
    checkboxes.forEach(cb => {
        if (!cb.checked) allChecked = false;
    });

    const newState = !allChecked;
    checkboxes.forEach(cb => {
        cb.checked = newState;
        if (newState) selectedLessons.add(cb.value);
        else selectedLessons.delete(cb.value);
    });
    
    const targetContent = document.getElementById(`content-${targetBook}`);
    if (targetContent) {
        targetContent.classList.add('open');
        const group = targetContent.parentElement;
        const arrow = group.querySelector('.arrow-icon');
        if (arrow) arrow.textContent = '▲';
    }

    updateBlocklist();
}

window.toggleAllLessons = function(checked) {
    const checkboxes = document.querySelectorAll('.lesson-cb');
    selectedLessons.clear();
    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked) selectedLessons.add(cb.value);
    });
    updateBlocklist();
}

function updateSelectedCountUI() {
    document.getElementById('selectedLessonCount').innerText = selectedLessons.size;
}

function updateBlocklist() {
    finalBlocklist.clear();
    selectedLessons.forEach(lesson => {
        const words = lessonData[lesson];
        if (words) {
            words.forEach(w => finalBlocklist.add(w));
        }
    });
    customOldVocab.forEach(w => finalBlocklist.add(w));
    
    const el = document.getElementById('totalBlockedCount');
    if (el) el.innerText = finalBlocklist.size;
    updateSelectedCountUI();
    updateBookMasterStatus();
}

function loadCustomVocab() {
    const stored = localStorage.getItem('customOldVocab');
    if (stored) {
        const list = JSON.parse(stored);
        list.forEach(w => customOldVocab.add(w));
    }
}

function saveCustomVocab() {
    localStorage.setItem('customOldVocab', JSON.stringify([...customOldVocab]));
    updateBlocklist();
}

function setupEventListeners() {
  document.getElementById('analyzeBtn').addEventListener('click', analyzeText);
  document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('inputText').value = '';
    document.getElementById('outputList').innerHTML = '';
    document.getElementById('stats').innerHTML = '<span>總字數: 0</span><span>生詞數: 0</span>';
    window.lastAnalysis = [];
  });

  document.getElementById('addOldVocabBtn').addEventListener('click', () => {
    const input = document.getElementById('oldVocabInput');
    const text = input.value.trim();
    if (!text) return;

    const words = text.split(/[\n,、\s]+/).map(w => w.trim()).filter(w => w);
    let addedCount = 0;
    words.forEach(w => {
        if (!customOldVocab.has(w)) {
            customOldVocab.add(w);
            addedCount++;
        }
    });

    saveCustomVocab();
    input.value = '';
    showStatus(`已新增 ${addedCount} 個補充舊詞`, 'success');
  });

  document.getElementById('showOldVocabBtn').addEventListener('click', () => {
    const list = [...customOldVocab].sort((a, b) => a.localeCompare(b, 'zh-TW'));
    document.getElementById('oldVocabInput').value = list.join('\n');
    showStatus(`目前有 ${list.length} 個補充舊詞`, 'info');
  });
  
  document.getElementById('clearOldVocabBtn').addEventListener('click', () => {
    if(confirm('確定要清除所有「手動補充」的舊詞嗎？(不會影響勾選的課本詞彙)')) {
        customOldVocab.clear();
        saveCustomVocab();
        document.getElementById('oldVocabInput').value = '';
        showStatus('已清除補充舊詞', 'success');
    }
  });

  document.getElementById('copyBtn').addEventListener('click', copyResults);
  document.getElementById('exportBtn').addEventListener('click', exportJSON);
  
  document.getElementById('splitInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      confirmSplit();
    }
  });
}

// 6. 核心分析功能
function analyzeText() {
  const text = document.getElementById('inputText').value;
  if (!text.trim()) {
    alert('請輸入文字');
    return;
  }

  const useAdvanced = document.getElementById('useAdvancedSegmenter').checked;
  const useGrammar = document.getElementById('useGrammarRules').checked;

  let words = [];
  if (useAdvanced && typeof advancedSegment !== 'undefined') {
    // 【修改】建立一個增強版的字典，包含 TBCL 和 所有已知詞彙 (課本詞 + 手動詞)
    // 目的：告訴斷詞引擎這些是「一個詞」，請優先匹配，不要亂切
    const segmentDict = { ...tbclData };
    knownWords.forEach(w => {
        if (!segmentDict[w]) segmentDict[w] = '0'; // 若 TBCL 沒有，暫定 Level 0 (代表已知但未分級)
    });

    words = advancedSegment(text, segmentDict, finalBlocklist, true, useGrammar);
  } else {
    // 瀏覽器原生斷詞
    const segmenter = new Intl.Segmenter('zh-TW', { granularity: 'word' });
    words = Array.from(segmenter.segment(text)).map(s => s.segment);
  }

  const results = [];
  const uniqueWords = new Set();
  
  words.forEach(word => {
    if (isPunctuation(word) || !word.trim()) return;
    if (finalBlocklist.has(word)) return; 

    if (uniqueWords.has(word)) return;
    uniqueWords.add(word);

    // 查詢等級
    let level = tbclData[word] || '0';
    results.push({ word, level });
  });

  window.lastAnalysis = results;
  displayResults();
}

function isPunctuation(text) {
  return /^[。，、；：！？「」『』（）《》…—\s\d\w]+$/.test(text);
}

// 7. 顯示結果 (含切分與合併功能)
function displayResults() {
  const results = window.lastAnalysis || [];
  const container = document.getElementById('outputList');
  container.innerHTML = '';

  if (results.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px;">沒有發現生詞！(全都是舊詞或已知詞彙)</div>';
  } else {
    results.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = `vocab-item level-${item.level}`;
      
      const levelText = item.level === '0' ? '未知' : `Level ${item.level}`;
      
      // 【新增】合併按鈕 (只要不是最後一個詞，都可以跟下一個合併)
      let mergeBtn = '';
      if (index < results.length - 1) {
          mergeBtn = `<button class="action-btn merge-btn" onclick="mergeWithNext(${index})" title="與下一個詞合併">🔗 合併</button>`;
      }

      div.innerHTML = `
        <div class="vocab-info">
            <span style="font-size: 18px; font-weight: bold;">${index + 1}. ${item.word}</span>
            <span class="level-tag">${levelText}</span>
        </div>
        <div class="vocab-actions">
            <button class="action-btn" onclick="openSplitModal(${index})" title="手動切分單字">✂️ 切分</button>
            ${mergeBtn}
        </div>
      `;
      container.appendChild(div);
    });
  }

  const wordCount = results.length;
  const charCount = document.getElementById('inputText').value.length;
  
  document.getElementById('stats').innerHTML = `
    <span>總字數: ${charCount}</span>
    <span>生詞數: ${wordCount}</span>
  `;
}

// 【新增】合併功能實作
window.mergeWithNext = function(index) {
    const list = window.lastAnalysis;
    if (!list || index >= list.length - 1) return;
    
    // 取得當前詞與下一個詞
    const w1 = list[index];
    const w2 = list[index + 1];
    
    // 合併字串
    const mergedWord = w1.word + w2.word;
    
    // 重新查詢合併後新詞的等級 (如果不在 TBCL 裡，就設為 '0')
    const mergedLevel = tbclData[mergedWord] || '0';
    
    // 更新陣列：移除這兩個詞 (deleteCount: 2)，插入合併後的新詞
    list.splice(index, 2, { word: mergedWord, level: mergedLevel });
    
    // 重新渲染畫面
    displayResults();
}

window.openSplitModal = function(index) {
    if (!window.lastAnalysis || !window.lastAnalysis[index]) return;
    
    editingIndex = index;
    const item = window.lastAnalysis[index];
    const modal = document.getElementById('splitModal');
    const input = document.getElementById('splitInput');
    
    input.value = item.word; 
    modal.style.display = 'block';
    
    setTimeout(() => { input.focus(); }, 100);
}

window.closeSplitModal = function() {
    document.getElementById('splitModal').style.display = 'none';
    editingIndex = -1;
}

window.confirmSplit = function() {
    if (editingIndex === -1) return;
    
    const inputVal = document.getElementById('splitInput').value;
    const originalWord = window.lastAnalysis[editingIndex].word;
    
    if (!inputVal.trim()) {
        closeSplitModal();
        return;
    }
    
    const newWordsRaw = inputVal.split(/\s+/).filter(w => w.trim());
    
    const newCombined = newWordsRaw.join('');
    if (newCombined !== originalWord) {
        if (!confirm(`您輸入的「${newCombined}」與原詞「${originalWord}」不符，確定要修改嗎？`)) {
            return;
        }
    }
    
    const newResultItems = newWordsRaw.map(word => {
        const level = tbclData[word] || '0';
        return { word, level };
    });
    
    window.lastAnalysis.splice(editingIndex, 1, ...newResultItems);
    
    displayResults();
    closeSplitModal();
}

function showStatus(msg, type) {
    const el = document.getElementById('vocabStatus');
    el.innerText = msg;
    el.className = `status ${type}`;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function copyResults() {
  if (!window.lastAnalysis || window.lastAnalysis.length === 0) return;
  const text = window.lastAnalysis.map((item, i) => `${i+1}. ${item.word} (Level ${item.level})`).join('\n');
  navigator.clipboard.writeText(text).then(() => alert('已複製到剪貼簿'));
}

function exportJSON() {
  if (!window.lastAnalysis) return;
  const data = JSON.stringify(window.lastAnalysis, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vocabulary_analysis.json';
  a.click();
}