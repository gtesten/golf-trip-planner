'use strict';

/* ========= UTILITIES ========= */

function toNumber(v){ return Number(v) || 0; }
function clamp18(a){ return [...(a||[])].slice(0,18).concat(Array(18).fill('')).slice(0,18); }
function defaultPars(){ return Array(18).fill(''); }
function defaultStrokeIndex(){ return Array(18).fill(''); }

export function getPlayersFromTextarea(){
  return (document.getElementById('playersInput')?.value || '')
    .split('\n').map(s=>s.trim()).filter(Boolean);
}

export function makeFoursomes(players) {
  const list = Array.isArray(players) ? players.slice() : [];
  const groups = [];
  for (let i = 0; i < list.length; i += 4) groups.push(list.slice(i, i + 4));
  return groups;
}

/* ========= RENDER ========= */

export function renderPairingsFromModel(model){
  const roundsEl = document.getElementById('roundsContainer');
  roundsEl.innerHTML='';
  (model.rounds.length?model.rounds:[{}])
    .forEach(r=>roundsEl.appendChild(createRoundCard(r, model.players)));
}

export function getPairingsModelFromDOM(){
  const rounds=[...document.querySelectorAll('.round-card')].map(card=>({
    course: card.querySelector('.round-course')?.value || '',
    date: card.querySelector('.round-date')?.value || '',
    groups: JSON.parse(card.dataset.groups||'[]'),
    lockGroups: card.dataset.lockGroups==='1',
    scores:[]
  }));
  return { players:getPlayersFromTextarea(), rounds };
}

/* ========= ROUND CARD ========= */

export function createRoundCard(round={}, players=[]){
  const card=document.createElement('div');
  card.className='round-card';

  const groups=round.groups?.length?round.groups:makeFoursomes(players);
  card.dataset.groups=JSON.stringify(groups);
  card.dataset.lockGroups=round.lockGroups?'1':'0';

  card.innerHTML=`
    <div class="round-header">
      <div class="round-header__left">
        <div class="round-title">Round</div>
        <div class="round-fields">
          <label class="field">
            <span class="field__label">Course</span>
            <input class="round-course" value="${round.course||''}">
          </label>
          <label class="field">
            <span class="field__label">Date</span>
            <input type="date" class="round-date" value="${round.date||''}">
          </label>
        </div>
      </div>
      <div class="round-header__right">
        <label class="lock-toggle">
          <input type="checkbox" class="lock-groups" ${card.dataset.lockGroups==='1'?'checked':''}>
          Lock groups
        </label>
      </div>
    </div>

    <div class="round-summary">
      <div class="round-summary__chips">
        <span class="chip"><strong>${players.length}</strong> players</span>
        <span class="chip"><strong>${groups.length}</strong> groups</span>
      </div>
    </div>

    <div class="round-groups"></div>
  `;

  const groupsWrap=card.querySelector('.round-groups');

  renderGroupsUI(card, groupsWrap);

  card.querySelector('.lock-groups').addEventListener('change',e=>{
    card.dataset.lockGroups=e.target.checked?'1':'0';
  });

  return card;
}

/* ========= GROUPS + PLAYER DRAG ========= */

function renderGroupsUI(card, wrap){
  const groups=JSON.parse(card.dataset.groups||'[]');
  wrap.innerHTML='';

  groups.forEach((group,gIdx)=>{
    const gEl=document.createElement('div');
    gEl.className='group-pill';
    gEl.dataset.groupIndex=gIdx;
    gEl.draggable=true;

    gEl.innerHTML=`<span class="group-pill__label">Group ${gIdx+1}</span>
      <div class="group-pill__names"></div>`;

    const namesWrap=gEl.querySelector('.group-pill__names');

    group.forEach((name,pIdx)=>{
      const p=document.createElement('span');
      p.className='name-chip';
      p.textContent=name;
      p.draggable=true;
      p.dataset.group=gIdx;
      p.dataset.index=pIdx;
      namesWrap.appendChild(p);

      p.addEventListener('dragstart',e=>{
        e.dataTransfer.setData('text/plain',JSON.stringify({
          type:'player',fromGroup:gIdx,fromIndex:pIdx,name
        }));
      });
    });

    gEl.addEventListener('dragover',e=>e.preventDefault());

    gEl.addEventListener('drop',e=>{
      const data=JSON.parse(e.dataTransfer.getData('text/plain'));
      if(data.type!=='player')return;

      const groups=JSON.parse(card.dataset.groups);
      groups[data.fromGroup].splice(data.fromIndex,1);
      groups[gIdx].push(data.name);

      card.dataset.groups=JSON.stringify(groups);
      renderGroupsUI(card, wrap);
    });

<<<<<<< HEAD
    wrap.appendChild(gEl);
=======
  for (let i = 1; i <= 18; i += 1) {
    const th = document.createElement('th');
    th.textContent = String(i);
    th.dataset.hole = String(i);
    th.classList.add(i <= 9 ? 'hole-front' : 'hole-back'); // ✅ shading hook
    tr.appendChild(th);
  }

  ['Out', 'In', 'Gross', 'Net'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    th.className = 'tot-col';
    tr.appendChild(th);
  });

  thead.appendChild(tr);
  return thead;
}

function buildScoreTableBody(round, players, pars = []) {
  const tbody = document.createElement('tbody');
  const scores = Array.isArray(round?.scores) ? round.scores : [];
  const byPlayer = new Map(scores.map((s) => [s?.player, s]));

  /* =========================
     PAR ROW (only meta row)
     ========================= */
  const parRow = document.createElement('tr');
  parRow.className = 'meta-row par-row';

  // Label cell
  const parLabel = document.createElement('td');
  parLabel.textContent = 'Par';
  parLabel.className = 'meta-label';
  parRow.appendChild(parLabel);

  // Empty Hdcp column
  parRow.appendChild(document.createElement('td'));

  for (let i = 0; i < 18; i += 1) {
    const td = document.createElement('td');
    td.dataset.hole = String(i + 1);

    const inp = document.createElement('input');
    inp.type = 'number';
    inp.inputMode = 'numeric';
    inp.className = 'par-input';
    inp.value = pars[i] ?? '';
    inp.placeholder = '';

    td.appendChild(inp);
    parRow.appendChild(td);
  }

  // Totals columns (empty for Par row)
  for (let i = 0; i < 4; i += 1) {
    parRow.appendChild(document.createElement('td'));
  }

  tbody.appendChild(parRow);

  /* =========================
     PLAYER SCORE ROWS
     ========================= */
  players.forEach((p) => {
    const s = byPlayer.get(p) || {
      player: p,
      hdcp: 0,
      holes: Array(18).fill('')
    };

    const tr = document.createElement('tr');
    tr.dataset.player = p;

    // Player
    const tdPlayer = document.createElement('td');
    tdPlayer.textContent = p;
    tr.appendChild(tdPlayer);

    // Handicap
    const tdHdcp = document.createElement('td');
    const hdcp = document.createElement('input');
    hdcp.type = 'number';
    hdcp.inputMode = 'numeric';
    hdcp.className = 'handicap-input';
    hdcp.value = String(toNumber(s.hdcp ?? 0));
    tdHdcp.appendChild(hdcp);
    tr.appendChild(tdHdcp);

    // Holes 1–18
    const holes = Array.isArray(s.holes) ? s.holes : [];
    for (let i = 0; i < 18; i += 1) {
      const td = document.createElement('td');
      td.dataset.hole = String(i + 1);

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.inputMode = 'numeric';
      inp.className = 'score-input';
      inp.value = holes[i] ?? '';

      td.appendChild(inp);
      tr.appendChild(td);
    }

    // Totals
    const tdOut = document.createElement('td');
    tdOut.className = 'tot-out';
    tr.appendChild(tdOut);

    const tdIn = document.createElement('td');
    tdIn.className = 'tot-in';
    tr.appendChild(tdIn);

    const tdGross = document.createElement('td');
    tdGross.className = 'tot-gross';
    tr.appendChild(tdGross);

    const tdNet = document.createElement('td');
    tdNet.className = 'tot-net';
    tr.appendChild(tdNet);

    tbody.appendChild(tr);
  });

  return tbody;
}

// Par/SI row builder
function buildMetaRow(label, values, inputClass) {
  const tr = document.createElement('tr');
  tr.className = 'meta-row';
  tr.dataset.meta = String(label || '').toLowerCase();

  // label cell (shows Par / SI)
  const tdLabel = document.createElement('td');
  tdLabel.className = 'meta-label';
  tdLabel.textContent = label;
  tr.appendChild(tdLabel);

  // blank Hdcp column cell for meta rows
  const tdBlank = document.createElement('td');
  tdBlank.textContent = '';
  tr.appendChild(tdBlank);

  const arr = clamp18(values);
  for (let i = 1; i <= 18; i += 1) {
    const td = document.createElement('td');
    td.dataset.hole = String(i);
    td.classList.add(i <= 9 ? 'hole-front' : 'hole-back'); // ✅ shading hook

    const inp = document.createElement('input');
    inp.type = 'number';
    inp.inputMode = 'numeric';
    inp.className = inputClass;
    inp.value = String(arr[i - 1] ?? '');

    td.appendChild(inp);
    tr.appendChild(td);
  }

  // Totals columns (empty)
  for (let k = 0; k < 4; k += 1) {
    tr.appendChild(document.createElement('td'));
  }

  return tr;
}

// -----------------------------
// Front/Back view toggling
// -----------------------------
function setToggleActive(toggleEl, view) {
  toggleEl.querySelectorAll('button[data-view]').forEach((b) => {
    b.classList.toggle('is-active', b.getAttribute('data-view') === view);
>>>>>>> bcb7d00 (Fix tabs not clickable y restoring pointer-events via CSS)
  });
}
