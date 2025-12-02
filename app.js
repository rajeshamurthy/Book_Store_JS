const APP = {
  el: document.getElementById('app'),
  navHome: document.getElementById('nav-home'),
  navAdd: document.getElementById('nav-add'),
  btnReset: document.getElementById('btn-reset'),
  storageKey: 'bookstore_static_v1',
  initialBooks: [
    {"id":1,"title":"Clean Code","author":"Robert C. Martin","price":399,"description":"A handbook of agile software craftsmanship.","isbn":"9780132350884"},
    {"id":2,"title":"You Don't Know JS","author":"Kyle Simpson","price":299,"description":"A deep dive into JavaScript.","isbn":"9781491904244"},
    {"id":3,"title":"Eloquent JavaScript","author":"Marijn Haverbeke","price":349,"description":"A modern introduction to programming.","isbn":"9781593279509"}
  ],
  books: []
};
function saveBooks(){
  localStorage.setItem(APP.storageKey, JSON.stringify(APP.books));
}

function loadFromLocal(){
  const raw = localStorage.getItem(APP.storageKey);
  if(!raw) return false;
  try{
    APP.books = JSON.parse(raw);
    return true;
  }catch(e){return false;}
}

async function tryLoadJSON(){
  try{
    const resp = await fetch('./books.json');
    if(!resp.ok) throw new Error('no books.json');
    const data = await resp.json();
    APP.books = data;
    saveBooks();
    return true;
  }catch(e){
    return false;
  }
}

async function init(){
  // priority: localStorage > fetch books.json > embedded
  if(loadFromLocal()){
    // ok
  } else {
    const ok = await tryLoadJSON();
    if(!ok){
      APP.books = APP.initialBooks.slice();
      saveBooks();
    }
  }
  bindEvents();
  route();
}

function bindEvents(){
  window.addEventListener('hashchange', route);
  APP.navHome.addEventListener('click', ()=>{ 
    location.hash = '#home'; 
  });
  APP.navAdd.addEventListener('click', ()=>{ 
    location.hash = '#add'; 
  });

    APP.btnReset.addEventListener('click', async ()=>{
    if(!confirm('Reset data to original books.json? This clears local changes.')) return;
    // try to reload from books.json; if not available, use embedded
    const ok = await tryLoadJSON();
    if(!ok){
      APP.books = APP.initialBooks.slice();
      saveBooks();
    }
    route();
    alert('Data reset.');
  });
}


function route(){
  const hash = location.hash || '#home';
  const m = hash.match(/^#(home|add|view|edit)(?:\/(\d+))?/);
  if(!m) return renderNotFound();
  const page = m[1], id = m[2] ? parseInt(m[2],10) : null;
  if(page==='home') renderHome();
  else if(page==='add') renderAdd();
  else if(page==='view') renderView(id);
  else if(page==='edit') renderEdit(id);
}

function renderNotFound(){
  APP.el.innerHTML = `<div class="card"><h1>Page not found</h1></div>`;
}


function renderHome(){
  APP.el.innerHTML = `
    <h1 class="page-title">All Books</h1>
    <div class="controls">
      <input id="q" class="input-search" placeholder="Search by title or author..." />
      <button id="btn-export" class="btn">Export JSON</button>
      <input id="file-import" type="file" accept=".json" style="display:none" />
      <button id="btn-import" class="btn secondary">Import JSON</button>
    </div>
    <div id="book-grid" class="grid"></div>
    <div style="margin-top:12px" class="small">Total books: <span id="count">0</span></div>
  `;
  const q = document.getElementById('q');
  const grid = document.getElementById('book-grid');
  const count = document.getElementById('count');
  const btnExport = document.getElementById('btn-export');
  const btnImport = document.getElementById('btn-import');
  const fileImport = document.getElementById('file-import');
function renderList(filter=''){
    const f = filter.trim().toLowerCase();
    const list = APP.books.filter(b=>{
      if(!f) return true;
      return b.title.toLowerCase().includes(f) || b.author.toLowerCase().includes(f) || (b.isbn||'').includes(f);
    });
    count.textContent = list.length;
    grid.innerHTML = list.map(b=>`
      <div class="card">
        <h3>${escapeHtml(b.title)}</h3>
        <div class="meta">by ${escapeHtml(b.author)} • ₹${b.price} • ISBN: ${escapeHtml(b.isbn||'—')}</div>
        <div class="small">${truncate(b.description||'',120)}</div>
        <div class="actions" style="margin-top:10px">
          <button class="btn" data-id="${b.id}" data-action="view">View</button>
          <button class="btn secondary" data-id="${b.id}" data-action="edit">Edit</button>
          <button class="btn" data-id="${b.id}" data-action="delete">Delete</button>
        </div>
      </div>
    `).join('');
        if(list.length===0) grid.innerHTML = `<div class="empty card">No books found. Add one using "Add Book".</div>`;
    // attach handlers
    grid.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', e=>{
        const id = parseInt(btn.dataset.id,10);
        const act = btn.dataset.action;
        if(act==='view') location.hash = '#view/' + id;
        else if(act==='edit') location.hash = '#edit/' + id;
        else if(act==='delete'){
          if(confirm('Delete this book?')) {
            APP.books = APP.books.filter(x=>x.id!==id);
            saveBooks();
            renderList(q.value);
          }
        }
      });
    });
  }
  q.addEventListener('input',()=> renderList(q.value));
  btnExport.addEventListener('click', ()=>{
    const dataStr = JSON.stringify(APP.books,null,2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'books-export.json'; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });
  btnImport.addEventListener('click', ()=> fileImport.click());
  fileImport.addEventListener('change', ()=> {
    const f = fileImport.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=> {
      try{
        const arr = JSON.parse(reader.result);
        if(!Array.isArray(arr)) throw new Error('Invalid');
        // ensure ids numeric
        arr.forEach((it,idx)=>{ if(!it.id) it.id = Date.now()+idx; });
        APP.books = arr;
        saveBooks();
        route();
        alert('Imported ' + arr.length + ' books.');
      }catch(e){ alert('Invalid JSON file.'); }
    };
    reader.readAsText(f);
  });

  renderList('');
}


function renderAdd(){
  APP.el.innerHTML = `
    <h1 class="page-title">Add Book</h1>
    <div class="card">
      <div class="form-row"><input id="title" placeholder="Title" /></div>
      <div class="form-row"><input id="author" placeholder="Author" /></div>
      <div class="form-row"><input id="isbn" placeholder="ISBN" /></div>
      <div class="form-row"><input id="price" placeholder="Price (₹)" type="number" /></div>
      <div class="form-row"><textarea id="desc" placeholder="Short description" rows="4"></textarea></div>
      <div class="footer-actions">
        <button id="btn-save" class="btn">Save</button>
        <button id="btn-cancel" class="btn secondary">Cancel</button>
      </div>
    </div>
  `;
  document.getElementById('btn-save').addEventListener('click', ()=>{
    const title = document.getElementById('title').value.trim();
    if(!title){ alert('Title required'); return; }
    const book = {
      id: Date.now(),
      title,
      author: document.getElementById('author').value.trim(),
      isbn: document.getElementById('isbn').value.trim(),
      price: Number(document.getElementById('price').value) || 0,
      description: document.getElementById('desc').value.trim()
    };
    APP.books.unshift(book);
    saveBooks();
    location.hash = '#home';
  });
  document.getElementById('btn-cancel').addEventListener('click', ()=> location.hash = '#home');
}


function renderView(id){
  const book = APP.books.find(b=>b.id===id);
  if(!book){ APP.el.innerHTML = `<div class="card"><h2>Book not found</h2></div>`; return; }
  APP.el.innerHTML = `
    <h1 class="page-title">${escapeHtml(book.title)}</h1>
    <div class="card">
      <div class="meta">by ${escapeHtml(book.author)} • ₹${book.price} • ISBN: ${escapeHtml(book.isbn||'—')}</div>
      <p class="small">${escapeHtml(book.description||'—')}</p>
      <div class="actions" style="margin-top:12px">
        <button id="btn-edit" class="btn secondary">Edit</button>
        <button id="btn-back" class="btn">Back</button>
      </div>
    </div>
  `;
  document.getElementById('btn-back').addEventListener('click', ()=> location.hash = '#home');
  document.getElementById('btn-edit').addEventListener('click', ()=> location.hash = '#edit/' + id);
}

function renderEdit(id){
  const book = APP.books.find(b=>b.id===id);
  if(!book){ APP.el.innerHTML = `<div class="card"><h2>Book not found</h2></div>`; return; }
  APP.el.innerHTML = `
    <h1 class="page-title">Edit Book</h1>
    <div class="card">
      <div class="form-row"><input id="title" placeholder="Title" value="${escapeHtml(book.title)}" /></div>
      <div class="form-row"><input id="author" placeholder="Author" value="${escapeHtml(book.author)}" /></div>
      <div class="form-row"><input id="isbn" placeholder="ISBN" value="${escapeHtml(book.isbn||'')}" /></div>
      <div class="form-row"><input id="price" placeholder="Price (₹)" type="number" value="${book.price}" /></div>
      <div class="form-row"><textarea id="desc" placeholder="Short description" rows="4">${escapeHtml(book.description||'')}</textarea></div>
      <div class="footer-actions">
        <button id="btn-update" class="btn">Update</button>
        <button id="btn-cancel" class="btn secondary">Cancel</button>
      </div>
    </div>
  `;
  document.getElementById('btn-update').addEventListener('click', ()=>{
    const title = document.getElementById('title').value.trim();
    if(!title){ alert('Title required'); return; }
    book.title = document.getElementById('title').value.trim();
    book.author = document.getElementById('author').value.trim();
    book.isbn = document.getElementById('isbn').value.trim();
    book.price = Number(document.getElementById('price').value) || 0;
    book.description = document.getElementById('desc').value.trim();
    saveBooks();
    location.hash = '#view/' + id;
  });
  document.getElementById('btn-cancel').addEventListener('click', ()=> location.hash = '#view/' + id);
}

/* Helpers */
function escapeHtml(s){
  if(!s) return '';
  return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
}
function truncate(s,n){ if(!s) return ''; return s.length>n? s.slice(0,n-1)+'…': s; }

/* init */
init();
