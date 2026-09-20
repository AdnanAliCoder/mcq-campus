(async function(){
  const app=document.getElementById('app');
  const h=(s)=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  async function api(path,opts={}){const r=await fetch('/api/'+path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...opts}); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.message||'Request failed'); return d;}
  async function load(){
    let session=await api('auth/session');
    if(!session.user){
      app.innerHTML=`<div class="topbar"><h1>MCQ Campus</h1></div><main class="container"><section class="card"><span class="pill">Light mode default</span><h2>Super Admin Login</h2><p class="muted">Use the email and password you added in Render environment variables.</p><form id="login"><div class="field"><label>Email</label><input name="email" type="email" required value="coadnanali@gmail.com"></div><div class="field"><label>Password</label><input name="password" type="password" required></div><button class="btn">Login</button><p id="msg" class="error"></p></form></section></main>`;
      document.getElementById('login').onsubmit=async(e)=>{e.preventDefault(); const fd=new FormData(e.target); try{await api('auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':session.csrfToken},body:JSON.stringify({email:fd.get('email'),password:fd.get('password')})}); load();}catch(err){document.getElementById('msg').textContent=err.message;}};
      return;
    }
    const data=await api('bootstrap');
    app.innerHTML=`<div class="topbar"><h1>MCQ Campus</h1></div><main class="container"><section class="card"><span class="pill">${h(session.user.role)}</span><h2>Welcome, ${h(session.user.name||session.user.email)}</h2><p class="muted">Django backend is live and connected. Super Admin controls will be expanded from this base.</p><div class="grid"><div class="card"><b>Total MCQs</b><h2>${data.stats.total_mcqs}</h2></div><div class="card"><b>Approved</b><h2>${data.stats.approved_mcqs}</h2></div><div class="card"><b>Pending</b><h2>${data.stats.pending_mcqs}</h2></div><div class="card"><b>Admins</b><h2>${data.stats.total_admins}</h2></div></div><p class="success">Supabase + Django setup is running.</p><button id="logout" class="btn">Logout</button></section></main>`;
    document.getElementById('logout').onclick=async()=>{await api('auth/logout',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':session.csrfToken},body:'{}'}); load();};
  }
  load().catch(e=>{app.innerHTML='<main class="container"><section class="card"><h2>Setup Error</h2><p class="error">'+h(e.message)+'</p></section></main>';});
})();