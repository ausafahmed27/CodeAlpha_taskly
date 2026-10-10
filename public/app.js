const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let tok=localStorage.tok,me=JSON.parse(localStorage.me||'null'),ws,projects=[],cur=null,openTask=null,unread=0,mode='login';
const COLORS=['#5b4bff','#12c2a0','#ff6b7a','#ffb547','#2fa8ff','#c05bff'],col=id=>COLORS[(id||0)%6],ini=n=>(n||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
const av=u=>u?`<span class="av" title="${esc(u.name)}" style="background:${col(u.id)}">${ini(u.name)}</span>`:'';
const api=async(p,m='GET',b)=>{const r=await fetch('/api'+p,{method:m,headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},body:b&&JSON.stringify(b)});const d=await r.json();if(!r.ok){if(r.status==401&&tok)logout();throw Error(d.error||'Something went wrong')}return d};
const toast=t=>{const e=document.createElement('div');e.className='toast';e.textContent=t;$('#toasts').append(e);setTimeout(()=>e.remove(),4500)};
const guard=f=>async(...a)=>{try{await f(...a)}catch(e){toast(e.message)}};
function logout(){localStorage.clear();tok=null;ws&&ws.close();authView()}
function authView(){const reg=mode=='register';$('#root').innerHTML=`<div class="auth"><form id="af"><h1>Taskly</h1><p>${reg?'Create your account and start a project.':'Welcome back. Pick up where your team left off.'}</p>
${reg?'<input name="name" placeholder="Full name" required>':''}<input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Password (6+ characters)" required>
<button class="btn">${reg?'Create account':'Sign in'}</button><p>${reg?'Have an account?':'New here?'} <button type="button" class="link" id="sw">${reg?'Sign in':'Create an account'}</button></p></form></div>`;
$('#sw').onclick=()=>{mode=reg?'login':'register';authView()};
$('#af').onsubmit=guard(async e=>{e.preventDefault();const d=await api('/'+mode,'POST',Object.fromEntries(new FormData(e.target)));tok=localStorage.tok=d.token;me=d.user;localStorage.me=JSON.stringify(me);start()})}
async function start(){connect();const n=await api('/notifications');unread=n.filter(x=>!x.read).length;shell();route()}
function connect(){ws=new WebSocket((location.protocol=='https:'?'wss':'ws')+'://'+location.host+'/ws?token='+tok);
ws.onmessage=guard(async e=>{const m=JSON.parse(e.data);if(m.type=='notification'){unread++;toast('🔔 '+m.text);bell()}
if(m.type=='project')loadProjects();if(cur&&m.project_id==cur.project.id&&m.type!='notification')await loadBoard(cur.project.id);if(m.type=='comment'&&openTask==m.task_id)loadComments()});ws.onclose=()=>tok&&setTimeout(connect,2000)}
function shell(){$('#root').innerHTML=`<div class="app"><aside class="side"><div class="logo">task<b>ly</b></div><div class="plist" id="pl"></div><button class="btn" id="np">+ New project</button>
<div class="me">${av(me)}<span>${esc(me.name)}</span><button class="link" id="lo" style="color:#c9ceee">Sign out</button></div></aside><main id="main"></main></div>`;
$('#np').onclick=newProject;$('#lo').onclick=logout;loadProjects()}
const bell=()=>{const b=$('#bell');if(b)b.innerHTML=`🔔${unread?`<i>${unread}</i>`:''}`};
const loadProjects=guard(async()=>{projects=await api('/projects');$('#pl').innerHTML=`<a href="#/" class="${cur?'':'on'}">▦ All projects</a>`+projects.map(p=>`<a href="#/p/${p.id}" class="${cur&&cur.project.id==p.id?'on':''}"><span class="dot" style="background:${col(p.id)}"></span>${esc(p.name)}</a>`).join('');if(!cur)home()});
const head=(t,s,extra='')=>`<div class="top"><div><h2>${t}</h2><div class="sub">${s}</div></div><div class="row">${extra}<button class="bell" id="bell" aria-label="Notifications"></button></div></div>`;
function wireBell(){bell();$('#bell').onclick=guard(async()=>{const n=await api('/notifications');await api('/notifications/read','POST');unread=0;bell();
$('#modal').innerHTML=`<div class="modal"><h2>Notifications</h2><div class="notes">${n.map(x=>`<div class="cm">${esc(x.text)}<br><small>${x.created}</small></div>`).join('')||'<div class="empty">You are all caught up.</div>'}</div><button class="btn ghost" id="x">Close</button></div>`;$('#x').onclick=closeM})}
const closeM=()=>{$('#modal').innerHTML='';openTask=null};
function home(){$('#main').innerHTML=head('Your projects',`${projects.length} active`)+(projects.length?`<div class="grid">${projects.map(p=>`<div class="card" onclick="location.hash='#/p/${p.id}'"><span class="dot" style="background:${col(p.id)}"></span><h3 style="margin:8px 0 4px">${esc(p.name)}</h3><div class="sub">${esc(p.description)||'No description'}</div><div class="bar"><i style="width:${p.total?p.done/p.total*100:0}%"></i></div><div class="sub" style="margin-top:6px;font-size:13px">${p.done}/${p.total} tasks done</div></div>`).join('')}</div>`:'<div class="empty">No projects yet. Create one to start planning.</div>');wireBell()}
const newProject=()=>{$('#modal').innerHTML=`<form class="modal" id="pf"><h2>New project</h2><input name="name" placeholder="Project name" required><textarea name="description" rows="3" placeholder="What is this project about?"></textarea><div class="row"><button class="btn">Create project</button><button type="button" class="btn ghost" id="x">Cancel</button></div></form>`;$('#x').onclick=closeM;
$('#pf').onsubmit=guard(async e=>{e.preventDefault();const d=await api('/projects','POST',Object.fromEntries(new FormData(e.target)));closeM();location.hash='#/p/'+d.id})};
async function route(){const m=location.hash.match(/#\/p\/(\d+)/);if(!tok)return;if(m){try{await loadBoard(m[1])}catch(e){toast(e.message);location.hash='#/'}}else{cur=null;loadProjects()}}
addEventListener('hashchange',route);
const COLS=[['todo','To do','#ffb547'],['doing','In progress','#5b4bff'],['done','Done','#12c2a0']];
async function loadBoard(id){cur=await api('/projects/'+id);if(!$('#pl'))return;const{project,members,tasks}=cur,mm=Object.fromEntries(members.map(u=>[u.id,u]));
document.querySelectorAll('#pl a').forEach(a=>a.classList.toggle('on',a.getAttribute('href')=='#/p/'+id));
$('#main').innerHTML=head(esc(project.name),esc(project.description)||'Drag cards between columns',`<div class="row">${members.map(av).join('')}</div><button class="btn ghost" id="inv">+ Invite</button>`)+`<div class="board">${COLS.map(([k,l,c])=>`<div class="col" data-s="${k}"><h3><span class="dot" style="background:${c}"></span>${l}<em>${tasks.filter(t=>t.status==k).length}</em></h3>
${tasks.filter(t=>t.status==k).map(t=>`<div class="task ${t.priority}" draggable="true" data-id="${t.id}"><b>${esc(t.title)}</b><div class="meta"><span>💬 ${t.comments}${t.due?' · 📅 '+esc(t.due):''}</span>${av(mm[t.assignee_id])}</div></div>`).join('')}
<form class="add"><input placeholder="Add a task" required><button class="btn">Add</button></form></div>`).join('')}</div>`;wireBell();
$('#inv').onclick=()=>{$('#modal').innerHTML=`<form class="modal" id="iv"><h2>Invite a teammate</h2><input name="email" type="email" placeholder="Their account email" required><div class="row"><button class="btn">Send invite</button><button type="button" class="btn ghost" id="x">Cancel</button></div></form>`;$('#x').onclick=closeM;
$('#iv').onsubmit=guard(async e=>{e.preventDefault();await api(`/projects/${id}/members`,'POST',Object.fromEntries(new FormData(e.target)));closeM();toast('Teammate added')})};
document.querySelectorAll('.add').forEach(f=>f.onsubmit=guard(async e=>{e.preventDefault();await api(`/projects/${id}/tasks`,'POST',{title:f.firstChild.value,status:f.parentNode.dataset.s})}));
document.querySelectorAll('.task').forEach(t=>{t.onclick=()=>taskModal(+t.dataset.id);t.ondragstart=e=>{e.dataTransfer.setData('id',t.dataset.id);t.classList.add('dragging')};t.ondragend=()=>t.classList.remove('dragging')});
document.querySelectorAll('.col').forEach(c=>{c.ondragover=e=>{e.preventDefault();c.classList.add('over')};c.ondragleave=()=>c.classList.remove('over');c.ondrop=guard(async e=>{e.preventDefault();c.classList.remove('over');await api('/tasks/'+e.dataTransfer.getData('id'),'PATCH',{status:c.dataset.s})})})}
function taskModal(id){const t=cur.tasks.find(x=>x.id==id);if(!t)return;openTask=id;const opt=(a,v)=>a.map(([k,l])=>`<option value="${k}" ${k==v?'selected':''}>${l}</option>`).join('');
$('#modal').innerHTML=`<form class="modal" id="tf"><input name="title" value="${esc(t.title)}" style="font-weight:800;font-size:18px"><textarea name="description" rows="3" placeholder="Add details">${esc(t.description)}</textarea>
<div class="two"><label>Status<select name="status">${opt(COLS.map(c=>[c[0],c[1]]),t.status)}</select></label><label>Priority<select name="priority">${opt([['low','Low'],['medium','Medium'],['high','High']],t.priority)}</select></label>
<label>Assigned to<select name="assignee_id"><option value="">Unassigned</option>${opt(cur.members.map(u=>[u.id,u.name]),t.assignee_id)}</select></label><label>Due date<input type="date" name="due" value="${esc(t.due||'')}"></label></div>
<div class="row"><button class="btn">Save changes</button><button type="button" class="btn danger" id="del">Delete</button><button type="button" class="btn ghost" id="x">Close</button></div>
<h3>Comments</h3><div id="cms"></div><div class="add"><input id="ci" placeholder="Write a comment"><button type="button" class="btn" id="cb">Post</button></div></form>`;
$('#x').onclick=closeM;$('#del').onclick=guard(async()=>{await api('/tasks/'+id,'DELETE');closeM()});
$('#tf').onsubmit=guard(async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));await api('/tasks/'+id,'PATCH',d);closeM();toast('Task saved')});
$('#cb').onclick=guard(async()=>{const i=$('#ci');await api(`/tasks/${id}/comments`,'POST',{body:i.value});i.value=''});loadComments()}
const loadComments=guard(async()=>{const c=await api(`/tasks/${openTask}/comments`);const b=$('#cms');if(b)b.innerHTML=c.map(x=>`<div class="cm"><b>${esc(x.name)}</b> <small>${x.created}</small><br>${esc(x.body)}</div>`).join('')||'<div class="sub">No comments yet. Start the conversation.</div>'});
tok?start().catch(logout):authView();
