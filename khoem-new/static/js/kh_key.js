/* kh_key.js — កូដបញ្ជាអន្តរកម្មក្ដារចុច */
const kbData = {
    kh: ['ក', 'ខ', 'គ', 'ឃ', 'ង', 'ច', 'ឆ', 'ជ', 'ឈ', 'ញ', 'ត', 'ថ', 'ទ', 'ធ', 'ន', 'ប', 'ផ', 'ព', 'ភ', 'ម', 'យ', 'រ', 'ល', 'វ', 'ស', 'ហ', 'អ', 'ា', 'ិ', 'ី', 'ុ', 'ូ'],
    en: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '.', ',', '?', '!'],
    cn: ['你', '好', '中', '国', '程', '序', '员', '数', '据', '开', '发', '网', '页', '设', '计'],
    code: ['<html>', '</div>', '<script>', 'console.log', 'function', 'const', 'let', 'document', 'getElementById', '=', '{', '}', ';', '(', ')']
};

function switchKb(type) {
    document.querySelectorAll('.kb-tab').forEach(t => t.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }

    const container = document.getElementById('keyContainer');
    if (!container) return;
    container.innerHTML = '';

    kbData[type].forEach(char => {
        const btn = document.createElement('div');
        btn.className = char.length > 3 ? 'key wide' : 'key';
        btn.textContent = char;
        btn.onclick = () => insertVal(char);
        container.appendChild(btn);
    });

    const del = document.createElement('div');
    del.className = 'key wide';
    del.textContent = '⌫ លុប';
    del.onclick = deleteVal;
    container.appendChild(del);
}

function insertVal(txt) {
    const input = document.getElementById('userInput');
    if (!input) return;
    input.value += txt;
    input.focus();
}

function deleteVal() {
    const input = document.getElementById('userInput');
    if (!input) return;
    input.value = input.value.slice(0, -1);
    input.focus();
}

window.addEventListener('DOMContentLoaded', () => {
    switchKb('kh');
});
