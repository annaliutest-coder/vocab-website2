// advanced-segmenter.js - 進階中文斷詞引擎

// ========================================
// 1. 基礎配置
// ========================================

// 常見單字詞（虛詞、連接詞、助詞等）
const SINGLE_CHAR_WORDS = new Set([
  // 連接詞
  '而', '且', '或', '與', '及', '和', '同', '並', '但', '卻', '則', '故',
  // 介詞
  '在', '於', '自', '從', '到', '向', '往', '給', '為', '被', '把', '對', '跟', '替',
  // 助詞
  '的', '得', '地', '了', '著', '過', '嗎', '呢', '吧', '啊', '呀', '哪', '啦',
  // 副詞
  '不', '也', '都', '又', '再', '還', '才', '就', '只', '很', '太', '更', '最', '挺',
  // 代詞
  '我', '你', '他', '她', '它', '們', '這', '那', '誰', '何', '哪', '某',
  // 數詞
  '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '萬',
  // 量詞
  '個', '位', '名', '條', '張', '本', '把', '件', '隻', '支', '枝', '根', '片'
]);

// 最大詞長
const MAX_WORD_LENGTH = 6;

// ========================================
// 2. 核心函數
// ========================================

/**
 * 檢查是否為已知詞彙
 */
function isKnownWord(word, tbclData, oldVocab) {
  return tbclData[word] || oldVocab.has(word);
}

/**
 * 檢查是否應該為單字
 */
function shouldBeSingleChar(char) {
  return SINGLE_CHAR_WORDS.has(char);
}

/**
 * 正向最大匹配
 */
function forwardMaxMatch(text, tbclData, oldVocab) {
  const words = [];
  let i = 0;
  
  while (i < text.length) {
    let matched = false;
    
    // 從最長開始嘗試
    for (let len = Math.min(MAX_WORD_LENGTH, text.length - i); len > 0; len--) {
      const candidate = text.substring(i, i + len);
      
      // 優先匹配已知詞彙
      if (isKnownWord(candidate, tbclData, oldVocab)) {
        words.push(candidate);
        i += len;
        matched = true;
        break;
      }
    }
    
    // 如果沒有匹配，取單字
    if (!matched) {
      words.push(text[i]);
      i++;
    }
  }
  
  return words;
}

/**
 * 反向最大匹配
 */
function backwardMaxMatch(text, tbclData, oldVocab) {
  const words = [];
  let i = text.length;
  
  while (i > 0) {
    let matched = false;
    
    for (let len = Math.min(MAX_WORD_LENGTH, i); len > 0; len--) {
      const candidate = text.substring(i - len, i);
      
      if (isKnownWord(candidate, tbclData, oldVocab)) {
        words.unshift(candidate);
        i -= len;
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      words.unshift(text[i - 1]);
      i--;
    }
  }
  
  return words;
}

/**
 * 選擇較佳的切分結果
 */
function chooseBetterResult(forward, backward) {
  // 規則1：詞彙數量少的較好
  if (forward.length !== backward.length) {
    return forward.length < backward.length ? forward : backward;
  }
  
  // 規則2：單字比例低的較好
  const forwardSingleCharRatio = forward.filter(w => w.length === 1).length / forward.length;
  const backwardSingleCharRatio = backward.filter(w => w.length === 1).length / backward.length;
  
  return forwardSingleCharRatio < backwardSingleCharRatio ? forward : backward;
}

/**
 * 雙向匹配
 */
function bidirectionalMatch(text, tbclData, oldVocab) {
  const forward = forwardMaxMatch(text, tbclData, oldVocab);
  const backward = backwardMaxMatch(text, tbclData, oldVocab);
  
  return chooseBetterResult(forward, backward);
}

/**
 * 詞性規則優化
 * 處理常見的單字詞
 */
function applyGrammarRules(words, tbclData, oldVocab) {
  const results = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // 如果詞長 > 1 且不是已知詞彙，嘗試拆分
    if (word.length > 1 && !isKnownWord(word, tbclData, oldVocab)) {
      const splitWords = smartSplit(word, tbclData, oldVocab);
      results.push(...splitWords);
    } else {
      results.push(word);
    }
  }
  
  return results;
}

/**
 * 智能拆分（基於詞性規則）
 */
function smartSplit(word, tbclData, oldVocab) {
  const chars = word.split('');
  const results = [];
  let i = 0;
  
  // 檢查是否所有字元都是單字詞
  const allSingleCharWords = chars.every(char => shouldBeSingleChar(char));
  
  // 如果全部都是應該單獨的字（如「而有」），拆分
  if (allSingleCharWords) {
    return chars;
  }
  
  while (i < chars.length) {
    // 檢查是否為單字詞
    if (shouldBeSingleChar(chars[i])) {
      results.push(chars[i]);
      i++;
      continue;
    }
    
    // 嘗試從當前位置匹配最長詞彙
    let matched = false;
    for (let len = Math.min(MAX_WORD_LENGTH, chars.length - i); len > 1; len--) {
      const candidate = chars.slice(i, i + len).join('');
      
      if (isKnownWord(candidate, tbclData, oldVocab)) {
        results.push(candidate);
        i += len;
        matched = true;
        break;
      }
    }
    
    // 沒有匹配到已知詞彙
    if (!matched) {
      // 檢查是否還有剩餘字元
      const remaining = chars.slice(i).join('');
      
      // 如果剩餘部分沒有單字詞，保持完整
      const hasOnlySingleCharWords = chars.slice(i).every(char => shouldBeSingleChar(char));
      
      if (!hasOnlySingleCharWords) {
        // 保持剩餘部分完整
        results.push(remaining);
        break;
      } else {
        // 全是單字詞，逐個添加
        results.push(chars[i]);
        i++;
      }
    }
  }
  
  return results;
}

/**
 * 按標點符號分句
 */
function splitBySentence(text) {
  // 保留標點符號
  return text.split(/([。！？；])/);
}

/**
 * 移除非中文字元（保留中文、標點）
 */
function cleanText(text) {
  // 只保留中文字元和常見標點
  return text.replace(/[^\u4e00-\u9fff。，、；：！？「」『』（）《》]/g, '');
}

// ========================================
// 3. 主要斷詞函數
// ========================================

/**
 * 進階中文斷詞
 * @param {string} text - 要分析的文字
 * @param {object} tbclData - TBCL 詞彙資料庫
 * @param {Set} oldVocab - 舊詞清單
 * @param {object} options - 選項
 * @returns {Array} 詞彙陣列
 */
function advancedSegment(text, tbclData, oldVocab, options = {}) {
  const {
    useBidirectional = true,  // 是否使用雙向匹配
    useGrammarRules = true,   // 是否使用詞性規則
    splitSentence = false      // 是否按句子分割
  } = options;
  
  // 清理文字
  const cleanedText = cleanText(text);
  
  if (!cleanedText) {
    return [];
  }
  
  let words = [];
  
  if (splitSentence) {
    // 按句子分割
    const sentences = splitBySentence(cleanedText);
    
    for (const sentence of sentences) {
      if (!sentence.trim() || /^[。，、；：！？「」『』（）《》]+$/.test(sentence)) {
        continue; // 跳過標點符號和空白
      }
      
      const sentenceWords = segmentSentence(sentence, tbclData, oldVocab, useBidirectional, useGrammarRules);
      words.push(...sentenceWords);
    }
  } else {
    words = segmentSentence(cleanedText, tbclData, oldVocab, useBidirectional, useGrammarRules);
  }
  
  return words;
}

/**
 * 分割單個句子
 */
function segmentSentence(sentence, tbclData, oldVocab, useBidirectional, useGrammarRules) {
  let words;
  
  if (useBidirectional) {
    // 雙向匹配
    words = bidirectionalMatch(sentence, tbclData, oldVocab);
  } else {
    // 僅正向匹配
    words = forwardMaxMatch(sentence, tbclData, oldVocab);
  }
  
  if (useGrammarRules) {
    // 應用詞性規則優化
    words = applyGrammarRules(words, tbclData, oldVocab);
  }
  
  return words;
}

// ========================================
// 4. 導出
// ========================================

// 如果在 Node.js 環境
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    advancedSegment,
    forwardMaxMatch,
    backwardMaxMatch,
    bidirectionalMatch,
    SINGLE_CHAR_WORDS
  };
}

// 如果在瀏覽器環境
if (typeof window !== 'undefined') {
  window.advancedSegment = advancedSegment;
}
