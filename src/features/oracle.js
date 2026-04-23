const KB = [
  { k: ['双币理财','dual','是什么','原理','包装'], a: '**双币理财 = 卖出期权的包装品。交易所通常扣留 15-40% premium 作为隐藏费用。' },
  { k: ['隐藏成本','hidden','spread','价差'], a: '**隐藏价差 = 期权APY - 双币APY**。本页主表即用于量化该差距。' },
  { k: ['风险','risk'], a: '主要风险：转换风险、机会成本、交易对手风险。' },
  { k: ['call','put','看涨','看跌'], a: 'CALL 更偏震荡/温和上涨；PUT 更偏震荡/温和回调并希望低价接币。' },
  { k: ['hello','你好','help','帮助'], a: '你好，我可以解答双币理财、期权对比、APY差异和风险问题。' },
];

let aiProvider = null;

export function setOracleAiProvider(fn) {
  aiProvider = typeof fn === 'function' ? fn : null;
}

function md(t) {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function findAnswer(q) {
  const ql = q.toLowerCase();
  for (const e of KB) if (e.k.some(k => ql.includes(k.toLowerCase()))) return e.a;
  return '可以试试问：双币理财是什么？隐藏成本怎么算？CALL 和 PUT 怎么选？';
}

function addMsg(role, text) {
  const c = document.getElementById('oracleMessages');
  const div = document.createElement('div');
  div.className = `oracle-msg ${role}`;
  const tag = document.createElement('div');
  tag.className = 'oracle-tag';
  tag.textContent = role === 'user' ? 'YOU' : 'ORACLE';
  const bubble = document.createElement('div');
  bubble.className = 'oracle-bubble';
  bubble.innerHTML = md(text);
  div.append(tag, bubble);
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
}

export function toggleOracle() {
  const drawer = document.getElementById('oracleDrawer');
  drawer.classList.toggle('open');
  if (drawer.classList.contains('open') && !document.querySelector('.oracle-msg.ai')) {
    addMsg('ai', '你好！我是 Oracle 助手。可以问我双币理财和期权对比问题。');
  }
}

export function sendOracleMsg() {
  const input = document.getElementById('oracleInput');
  const text = input.value.trim();
  if (!text) return;
  const aiMode = !!document.getElementById('oracleAiToggle')?.checked;
  addMsg('user', text);
  input.value = '';
  if (aiMode && aiProvider) {
    aiProvider(text)
      .then((ans) => addMsg('ai', ans || findAnswer(text)))
      .catch(() => addMsg('ai', findAnswer(text)));
    return;
  }
  setTimeout(() => addMsg('ai', findAnswer(text)), 280);
}
