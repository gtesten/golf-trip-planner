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

function makeFoursomes(players) {
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

    wrap.appendChild(gEl);
  });
}
